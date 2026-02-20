import mongoose, { FilterQuery, Types } from 'mongoose';
import crypto from 'crypto';
import Claim, { IClaim } from './claim.model';
import Item, { IItem } from '../item/item.model';
import User, { IUser } from '../user/user.model';
import Activity from '../activity/activity.model';
import { 
  ActivityAction,
  ClaimStatus, 
  ItemStatus,
  NotificationEvent,
  IItemModel
} from '../../common/types';
import { ForbiddenError, NotFoundError, ValidationError } from '../../common/errors';
import activityService from '../activity/activity.service';
import logger from '../../common/utils/logger';

import notificationService from '../notification/notification.service';

import fraudService from '../fraud/fraud.service';

class ClaimService {
  async createClaim(data: {
    itemId: string;
    claimantId?: string;
    description: string;
    lostReportId?: string;
    isAnonymous?: boolean;
    email?: string;
    claimToken?: string;
    preferredPickupLocation?: string;
    proofDocuments?: { type: string; filename: string; path: string }[];
  }): Promise<IClaim> {
    const session = await mongoose.startSession();
    try {
      return await session.withTransaction(async () => {
        // Check if item exists and is available
        const item = await Item.findById(data.itemId).select('+secretIdentifiers').session(session);

        if (!item) {
          throw new NotFoundError('Item not found');
        }

        if (item.status !== ItemStatus.AVAILABLE) {
          throw new ValidationError('Item is not available for claiming');
        }

        // Check for existing VERIFIED claims
        const verifiedClaim = await Claim.findOne({
          itemId: data.itemId,
          status: { $in: [ClaimStatus.VERIFIED, ClaimStatus.PICKUP_BOOKED, ClaimStatus.AWAITING_TRANSFER, ClaimStatus.IN_TRANSIT, ClaimStatus.ARRIVED] },
        }).session(session);

        if (verifiedClaim) {
          throw new ValidationError('Item has already been claimed and verified by another user');
        }

        // Check if this specific user already has a pending claim for this item
        if (data.claimantId) {
          const userClaim = await Claim.findOne({
            itemId: data.itemId,
            claimantId: data.claimantId,
            status: { $nin: [ClaimStatus.REJECTED, ClaimStatus.CANCELLED] }
          }).session(session);

          if (userClaim) {
            throw new ValidationError('You already have an active claim for this item');
          }
        }

        const claimData = {
          ...data,
          preferredPickupLocation: data.preferredPickupLocation || item.storageLocation,
          proofDocuments: data.proofDocuments?.map((doc) => ({
            ...doc,
            uploadedAt: new Date()
          })) || []
        };
        
        const [claim] = await Claim.create([claimData], { session });

        // Item status remains AVAILABLE until verification
        // This allows the item to stay visible in public search

        // Log activity if claimant exists
        if (data.claimantId) {
            await activityService.logActivity({
              action: ActivityAction.CLAIM_FILED,
              userId: data.claimantId,
              entityType: 'Claim',
              entityId: claim._id.toString(),
              metadata: { itemId: data.itemId },
            });

            // Calculate fraud risk score (non-blocking, but we can't easily do this inside transaction if it calls external services)
            // fraudService seems local/internal, but let's keep it safe.
            try {
              const activities = await Activity.find({ userId: data.claimantId }).sort({ createdAt: -1 }).limit(100).session(session);
              const fraudDetail = await fraudService.calculateFraudRiskScore(
                data.claimantId,
                activities,
                { itemId: data.itemId, claimDescription: data.description }
              );
              claim.fraudRiskScore = fraudDetail.score;
              claim.fraudFlags = fraudDetail.flags;
              await claim.save({ session });
            } catch (err) {
              // Non-blocking — don't fail claim creation if fraud check errors
            }
        }

        // Request proof if none provided
        if (!data.proofDocuments || data.proofDocuments.length === 0) {
            await this.internalRequestProof(claim._id.toString(), session);
        }
        
        // Auto-generate a challenge question if item has secret identifiers
        await this.tryAutoGenerateChallengeQuestion(claim._id.toString(), item, session);

        // Notify Staff about new claim (async, outside transaction concern)
        notificationService.notifyStaff({
          event: NotificationEvent.NEW_CLAIM_PENDING,
          data: {
            claimId: claim._id.toString(),
            itemDescription: item.description,
            claimantName: (await User.findById(data.claimantId).select('name').session(session))?.name || 'A user'
          },
          referenceId: claim._id.toString()
        }).catch(err => logger.error('Failed to notify staff about new claim:', err));

        return claim;
      });
    } finally {
      await session.endSession();
    }
  }

  async createAnonymousClaim(data: {
      itemId: string;
      email: string;
      description: string;
      preferredPickupLocation?: string;
      proofDocuments?: { type: string; filename: string; path: string }[];
  }): Promise<IClaim> {
      // Use crypto-secure token (12 hex chars = shareable verbally)
      const token = crypto.randomBytes(6).toString('hex');
      const claim = await this.createClaim({
          ...data,
          isAnonymous: true,
          claimToken: token
      });

      // Notify immediately with token
      await notificationService.queueNotification({
          event: NotificationEvent.ANONYMOUS_CLAIM_CREATED,
          recipientEmail: data.email,
          data: {
              token,
              claimId: claim._id.toString(),
              message: 'Your anonymous claim has been filed. Use the token below to track or link your claim.'
          }
      });

      // Notify Staff about new anonymous claim
      notificationService.notifyStaff({
        event: NotificationEvent.NEW_CLAIM_PENDING,
        data: {
          claimId: claim._id.toString(),
          itemDescription: 'Anonymous Claim',
          claimantName: 'Anonymous Guest'
        },
        referenceId: claim._id.toString()
      }).catch(err => logger.error('Failed to notify staff about anonymous claim:', err));

      return claim;
  }

  /**
   * Evaluates an item for secret data and generates a challenge question if applicable.
   */
  private async tryAutoGenerateChallengeQuestion(claimId: string, item: IItemModel, session?: mongoose.ClientSession): Promise<void> {
    const claim = await Claim.findById(claimId).session(session || null);
    if (!claim) return;

    let question = null;

    // Check for explicit "secret identifiers"
    if (item.secretIdentifiers && item.secretIdentifiers.length > 0) {
      question = "Please list a specific, secret identifying mark or feature of this item not visible in the public photos.";
    } 
    // Fallback to evaluating missing properties.
    else if (item.color) {
      question = "What is the primary color of this item? (Please specify inner/outer lining if applicable).";
    }

    if (question) {
      const systemAdmin = await User.findOne({ role: 'ADMIN' }, '_id').lean().session(session || null) || { _id: new Types.ObjectId() };
      
      if (!claim.challengeHistory) claim.challengeHistory = [];
      claim.challengeHistory.push({
        question,
        conductedAt: new Date(),
        conductedBy: systemAdmin._id,
      });
      await claim.save({ session });

      // Log activity
      await activityService.logActivity({
        action: ActivityAction.CHALLENGE_ISSUED,
        userId: systemAdmin._id.toString(),
        entityType: 'Claim',
        entityId: claimId,
        metadata: { updateType: 'AUTO_CHALLENGE_GENERATED' },
      });
    }
  }

  async addChallengeQuestion(
    claimId: string,
    question: string,
    staffId: string
  ): Promise<IClaim> {
    const claim = await Claim.findById(claimId);
    if (!claim) throw new NotFoundError('Claim not found');

    if (!claim.challengeHistory) claim.challengeHistory = [];
    claim.challengeHistory.push({
      question,
      conductedAt: new Date(),
      conductedBy: staffId as unknown as IUser['_id'],
    });
    
    await claim.save();

    // Log activity
    await activityService.logActivity({
      action: ActivityAction.CHALLENGE_ISSUED,
      userId: staffId,
      entityType: 'Claim',
      entityId: claimId,
      metadata: { updateType: 'CHALLENGE_ADDED' },
    });

    // Notify claimant
    if (claim.claimantId) {
      await notificationService.queueNotification({
        event: NotificationEvent.PROOF_REQUESTED,
        userId: claim.claimantId.toString(),
        data: {
          claimId,
          question,
          message: 'A challenge question has been added to your claim. Please review and answer it.',
        },
      });
    }

    return claim;
  }

  async submitChallengeResponse(
    claimId: string,
    challengeId: string,
    answer: string,
    userId: string
  ): Promise<{ matchScore: number; passed: boolean; claimId: string }> {
    const claim = await Claim.findById(claimId);
    if (!claim) throw new NotFoundError('Claim not found');

    const item = await Item.findById(claim.itemId).select('+secretIdentifiers');
    if (!item) throw new NotFoundError('Item not found');

    const secrets = item.secretIdentifiers ?? [];
    if (secrets.length === 0) {
      throw new ValidationError('This item has no secret identifiers configured for challenge-response');
    }

    // Find the challenge
    if (!claim.challengeHistory) claim.challengeHistory = [];
    const challenge = claim.challengeHistory.find((c) => c._id?.toString() === challengeId);
    if (!challenge) {
      throw new NotFoundError('Challenge question not found');
    }

    if (challenge.answer) {
      throw new ValidationError('Challenge has already been answered');
    }

    // Fuzzy match
    const bestScore = secrets.reduce((best, secret) => {
      const score = this.fuzzyMatchScore(answer.toLowerCase().trim(), secret.toLowerCase().trim());
      return Math.max(best, score);
    }, 0);

    const passed = bestScore >= 75;

    challenge.answer = answer;
    challenge.matchScore = bestScore;
    challenge.passed = passed;
    
    await claim.save();

    // Log activity
    await activityService.logActivity({
      action: ActivityAction.CHALLENGE_ANSWERED,
      userId: userId,
      entityType: 'Claim',
      entityId: claimId,
      metadata: { updateType: 'CHALLENGE_ANSWERED', passed, matchScore: bestScore },
    });

    // Notify claimant
    await notificationService.queueNotification({
      event: NotificationEvent.CLAIM_STATUS_UPDATE,
      userId: userId,
      data: {
        claimId,
        status: passed ? 'Challenge Passed' : 'Challenge Failed',
        notes: `Your answer to the challenge question was evaluated. Score: ${bestScore}/100. ${passed ? 'You passed!' : 'Unfortunately, it did not match expected records.'}`
      },
    });

    return { matchScore: bestScore, passed, claimId };
  }

  private fuzzyMatchScore(s1: string, s2: string): number {
    if (s1 === s2) return 100;
    if (!s1 || !s2) return 0;
    const maxLen = Math.max(s1.length, s2.length);
    const distance = this.levenshtein(s1, s2);
    return Math.round(((maxLen - distance) / maxLen) * 100);
  }

  private levenshtein(s1: string, s2: string): number {
    const m = s1.length, n = s2.length;
    const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
      Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
    );
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        dp[i][j] = s1[i - 1] === s2[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
    return dp[m][n];
  }

  private redactSensitiveItemData(item: Partial<IItem>): Partial<IItem> {
    if (!item) return item;
    const redacted = { ...item };
    delete redacted.brand;
    delete redacted.bagContents;
    delete redacted.secretIdentifiers;
    delete redacted.storageLocation;
    delete redacted.finderContact;
    delete redacted.registeredBy;
    delete redacted.prediction;
    return redacted;
  }

  async getClaimById(claimId: string, role?: string): Promise<IClaim> {
    const query = Claim.findById(claimId)
      .populate({
        path: 'itemId',
        populate: {
          path: 'storageLocation',
          model: 'Storage',
        },
      })
      .populate('claimantId', 'name email')
      .populate('verifiedBy', 'name email')
      .populate('lostReportId');
      
    const claim = await query.exec();

    if (!claim) {
      throw new NotFoundError('Claim not found');
    }

    if (role === 'STAFF' || role === 'ADMIN') {
      const itemWithSecrets = await Item.findById((claim.itemId as unknown as IItem)._id).select('+secretIdentifiers');
      if (itemWithSecrets && claim.itemId && typeof claim.itemId === 'object') {
        const item = claim.itemId as unknown as IItem;
        item.secretIdentifiers = itemWithSecrets.secretIdentifiers;
      }
    } else {
      const isVerified = [
        ClaimStatus.VERIFIED, 
        ClaimStatus.AWAITING_TRANSFER, 
        ClaimStatus.AWAITING_RECOVERY,
        ClaimStatus.IN_TRANSIT,
        ClaimStatus.ARRIVED,
        ClaimStatus.PICKUP_BOOKED, 
        ClaimStatus.RETURNED
      ].includes(claim.status);
      
      if (!isVerified && claim.itemId && typeof claim.itemId === 'object') {
        const itemObj = (claim.itemId as unknown as mongoose.Document).toObject 
          ? (claim.itemId as unknown as mongoose.Document).toObject() 
          : (claim.itemId as unknown as IItem);
        claim.itemId = this.redactSensitiveItemData(itemObj) as unknown as IItem;
      }
    }

    return claim;
  }

  async getMyClaims(
    userId: string,
    filters: { status?: ClaimStatus; keyword?: string; itemId?: string; date?: string },
    pagination: { page: number; limit: number }
  ): Promise<{ data: IClaim[]; total: number }> {
    const query: FilterQuery<IClaim> = { claimantId: userId };

    if (filters.status) query.status = filters.status;
    if (filters.itemId) query.itemId = filters.itemId;

    if (filters.date) {
        const startOfDay = new Date(filters.date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(filters.date);
        endOfDay.setHours(23, 59, 59, 999);
        query.createdAt = { $gte: startOfDay, $lte: endOfDay };
    }

    if (filters.keyword) {
      // Use text search for keyword indexing if available
      const matchingItems = await Item.find({ $text: { $search: filters.keyword } }).select('_id');
      const itemIds = matchingItems.map(item => item._id);

      const keywordRegex = new RegExp(filters.keyword, 'i');
      query.$or = [
        { description: keywordRegex },
        { itemId: { $in: itemIds } }
      ];
    }

    const total = await Claim.countDocuments(query);
    const claims = await Claim.find(query)
      .sort({ createdAt: -1 })
      .skip((pagination.page - 1) * pagination.limit)
      .limit(pagination.limit)
      .populate({
        path: 'itemId',
        populate: {
          path: 'storageLocation',
          model: 'Storage'
        }
      })
      .populate('lostReportId');

    const redactedClaims = claims.map(claim => {
      const claimObj = claim.toObject();
      const isVerified = [
        ClaimStatus.VERIFIED, 
        ClaimStatus.AWAITING_TRANSFER, 
        ClaimStatus.AWAITING_RECOVERY,
        ClaimStatus.IN_TRANSIT,
        ClaimStatus.ARRIVED,
        ClaimStatus.PICKUP_BOOKED, 
        ClaimStatus.RETURNED
      ].includes(claim.status);
      
      if (!isVerified && claimObj.itemId) {
        claimObj.itemId = this.redactSensitiveItemData(claimObj.itemId as unknown as IItem) as IItem;
      }
      return claimObj;
    });

    return { data: redactedClaims as IClaim[], total };
  }

  async getAllClaims(
    filters: { status?: ClaimStatus; keyword?: string; itemId?: string; date?: string },
    pagination: { page: number; limit: number }
  ): Promise<{ data: IClaim[]; total: number }> {
    const query: FilterQuery<IClaim> = {};
    
    if (filters.status) query.status = filters.status;
    if (filters.itemId) query.itemId = filters.itemId;

    if (filters.keyword) {
      // Use text search for keyword indexing
      const [matchingItems, matchingUsers] = await Promise.all([
        Item.find({ $text: { $search: filters.keyword } }).select('_id'),
        User.find({ $text: { $search: filters.keyword } }).select('_id')
      ]);
      
      const itemIds = matchingItems.map(item => item._id);
      const userIds = matchingUsers.map(user => user._id);

      const keywordRegex = new RegExp(filters.keyword, 'i');
      query.$or = [
        { description: keywordRegex },
        { rejectionReason: keywordRegex },
        { verificationNotes: keywordRegex },
        { itemId: { $in: itemIds } },
        { claimantId: { $in: userIds } }
      ];
    }
    
    if (filters.date) {
        const startOfDay = new Date(filters.date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(filters.date);
        endOfDay.setHours(23, 59, 59, 999);
        query.createdAt = { $gte: startOfDay, $lte: endOfDay };
    }

    const total = await Claim.countDocuments(query);
    const claims = await Claim.find(query)
      .sort({ createdAt: -1 })
      .skip((pagination.page - 1) * pagination.limit)
      .limit(pagination.limit)
      .populate({
        path: 'itemId',
        populate: {
          path: 'storageLocation',
          model: 'Storage'
        }
      })
      .populate('claimantId', 'name email')
      .populate('verifiedBy', 'name email');

    return { data: claims, total };
  }

  async uploadProof(
    claimId: string,
    userId: string,
    proofDocuments: { type: string; filename: string; path: string }[]
  ): Promise<IClaim> {
    const claim = await Claim.findOne({ _id: claimId, claimantId: userId });
    if (!claim) throw new NotFoundError('Claim not found or unauthorized');

    const validUploadStates = [ClaimStatus.FILED, ClaimStatus.IDENTITY_PROOF_REQUESTED];
    if (!validUploadStates.includes(claim.status as ClaimStatus)) {
      throw new ValidationError(`Claim is not in a valid state for proof upload (current: ${claim.status})`);
    }

    claim.proofDocuments.push(
      ...proofDocuments.map((doc) => ({
        ...doc,
        uploadedAt: new Date(),
      }))
    );

    if (claim.status === ClaimStatus.IDENTITY_PROOF_REQUESTED) {
      claim.status = ClaimStatus.FILED;
    }

    await claim.save();

    await activityService.logActivity({
      action: ActivityAction.PROOF_UPLOADED,
      userId,
      entityType: 'Claim',
      entityId: claimId,
      metadata: { documentCount: proofDocuments.length },
    });

    return claim;
  }

  async verifyClaim(
    claimId: string,
    verifierId: string,
    notes?: string
  ): Promise<IClaim> {
    const session = await mongoose.startSession();
    try {
      return await session.withTransaction(async () => {
        const claim = await Claim.findById(claimId).populate('itemId').session(session);
        if (!claim) throw new NotFoundError('Claim not found');

        if (!claim.preferredPickupLocation && claim.itemId && typeof claim.itemId === 'object') {
          const item = claim.itemId as unknown as IItemModel;
          if (item.storageLocation) {
            claim.preferredPickupLocation = item.storageLocation;
          }
        }

        if (claim.proofDocuments.length === 0) {
          throw new ValidationError('No proof documents uploaded');
        }

        claim.status = ClaimStatus.VERIFIED;
        claim.verifiedBy = new Types.ObjectId(verifierId);
        claim.verifiedAt = new Date();
        claim.verificationNotes = notes;
        await claim.save({ session });

        // Hide item from public search and mark as claimed
        const item = await Item.findById(claim.itemId).session(session);
        if (item) {
          item.status = ItemStatus.CLAIMED;
          item.claimedBy = claim.claimantId ? new Types.ObjectId(claim.claimantId.toString()) : undefined;
          await item.save({ session });
        }

        await activityService.logActivity({
          action: ActivityAction.CLAIM_VERIFIED,
          userId: verifierId,
          entityType: 'Claim',
          entityId: claimId,
          metadata: { claimantId: claim.claimantId?.toString() ?? 'anonymous' },
        });

        // Notifications
        if (claim.claimantId) {
            const claimantId = claim.claimantId.toString();
            const claimantUser = await User.findById(claimantId).select('name').session(session);
            const item = claim.itemId as unknown as { dateFound: Date; description: string };

            const HANDLING_FEE = 40;
            const STORAGE_FEE_PER_DAY = 5;
            const daysStored = item?.dateFound
            ? Math.max(1, Math.ceil(Math.abs(Date.now() - new Date(item.dateFound).getTime()) / 86400000))
            : 1;
            const storageFee = daysStored * STORAGE_FEE_PER_DAY;
            const totalAmount = HANDLING_FEE + storageFee;

            await Promise.all([
              notificationService.queueNotification({
                  event: NotificationEvent.CLAIM_STATUS_UPDATE,
                  userId: claimantId,
                  data: { claimId, status: ClaimStatus.VERIFIED, notes },
              }),
              notificationService.queueNotification({
                  event: NotificationEvent.PAYMENT_REQUIRED,
                  userId: claimantId,
                  data: {
                    claimId,
                    claimantName: claimantUser?.name ?? 'there',
                    itemDescription: item?.description ?? 'your item',
                    handlingFee: HANDLING_FEE,
                    storageFee,
                    daysStored,
                    totalAmount,
                  },
              }),
            ]);
        }
        return claim;
      });
    } finally {
      await session.endSession();
    }
  }

  async requestProofManually(
    claimId: string,
    adminId: string
  ): Promise<IClaim> {
    const claim = await Claim.findById(claimId);
    if (!claim) throw new NotFoundError('Claim not found');

    if (claim.status !== ClaimStatus.FILED) {
      throw new ValidationError(`Cannot request proof from state: ${claim.status}`);
    }

    claim.status = ClaimStatus.IDENTITY_PROOF_REQUESTED;
    await claim.save();

    await activityService.logActivity({
      action: ActivityAction.PROOF_REQUESTED,
      userId: adminId,
      entityType: 'Claim',
      entityId: claimId,
      metadata: { newStatus: ClaimStatus.IDENTITY_PROOF_REQUESTED },
    });

    // Notify
    if (claim.claimantId) {
        await notificationService.queueNotification({
            event: NotificationEvent.PROOF_REQUESTED,
            userId: claim.claimantId.toString(),
            data: { claimId: claim._id.toString() },
        });
    } else if (claim.isAnonymous && claim.email) {
        await notificationService.queueNotification({
            event: NotificationEvent.PROOF_REQUESTED,
            recipientEmail: claim.email,
            data: { claimId: claim._id.toString(), token: claim.claimToken },
        });
    }

    return claim;
  }

  async rejectClaim(
    claimId: string,
    verifierId: string,
    reason: string
  ): Promise<IClaim> {
    const session = await mongoose.startSession();
    try {
      return await session.withTransaction(async () => {
        const claim = await Claim.findById(claimId).populate('itemId').session(session);
        if (!claim) throw new NotFoundError('Claim not found');

        claim.status = ClaimStatus.REJECTED;
        claim.verifiedBy = new Types.ObjectId(verifierId);
        claim.verifiedAt = new Date();
        claim.rejectionReason = reason;
        await claim.save({ session });

        const item = await Item.findById(claim.itemId).session(session);
        if (item) {
          item.status = ItemStatus.AVAILABLE;
          item.claimedBy = undefined;
          await item.save({ session });
        }

        await activityService.logActivity({
          action: ActivityAction.CLAIM_REJECTED,
          userId: verifierId,
          entityType: 'Claim',
          entityId: claimId,
          metadata: { reason },
        });

        if (claim.claimantId) {
            await notificationService.queueNotification({
              event: NotificationEvent.CLAIM_STATUS_UPDATE,
              userId: claim.claimantId.toString(),
              data: { claimId, status: ClaimStatus.REJECTED, notes: reason },
            });
        }
        return claim;
      });
    } finally {
      await session.endSession();
    }
  }

  async updateClaimStatus(
    claimId: string,
    status: ClaimStatus
  ): Promise<IClaim> {
    const claim = await Claim.findById(claimId);
    if (!claim) throw new NotFoundError('Claim not found');

    claim.status = status;
    await claim.save();

    return claim;
  }

  /**
   * Internal helper for requesting proof (shared between auto and manual)
   */
  private async internalRequestProof(claimId: string, session?: mongoose.ClientSession): Promise<IClaim> {
    const claim = await Claim.findById(claimId).session(session || null);
    if (!claim) throw new NotFoundError('Claim not found');

    claim.status = ClaimStatus.IDENTITY_PROOF_REQUESTED;
    await claim.save({ session });

    // Activity log
    await activityService.logActivity({
      action: ActivityAction.PROOF_REQUESTED,
      userId: claim.claimantId?.toString() || 'SYSTEM', // If auto, log as system
      entityType: 'Claim',
      entityId: claimId,
      metadata: { autoGenerated: !!session },
    });

    // Notify
    if (claim.claimantId) {
        await notificationService.queueNotification({
            event: NotificationEvent.PROOF_REQUESTED,
            userId: claim.claimantId.toString(),
            data: { claimId: claim._id.toString() },
        });
    } else if (claim.isAnonymous && claim.email) {
        await notificationService.queueNotification({
            event: NotificationEvent.PROOF_REQUESTED,
            recipientEmail: claim.email,
            data: { claimId: claim._id.toString(), token: claim.claimToken },
        });
    }

    return claim;
  }

  async deleteClaim(claimId: string, userId: string, userRole: string): Promise<void> {
    const claim = await Claim.findById(claimId);
    if (!claim) throw new NotFoundError('Claim not found');

    // Access control
    if (userRole === 'CLAIMANT' && claim.claimantId?.toString() !== userId) {
      throw new ForbiddenError('You do not have permission to delete this claim');
    }

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        // Soft delete claim
        claim.deletedAt = new Date();
        await claim.save({ session });

        // Revert item status if it was CLAIMED
        const item = await Item.findById(claim.itemId).session(session);
        if (item && item.status === ItemStatus.CLAIMED) {
          item.status = ItemStatus.AVAILABLE;
          item.claimedBy = undefined;
          await item.save({ session });
        }

        // Log activity
        await activityService.logActivity({
          action: ActivityAction.CLAIM_REJECTED, // Or add CLAIM_DELETED
          userId,
          entityType: 'Claim',
          entityId: claimId,
          metadata: { action: 'DELETED_SOFT', deletedBy: userRole },
        });
      });
    } finally {
      await session.endSession();
    }
  }
}

export default new ClaimService();
