import Claim, { IClaim } from './claim.model';
import Item from '../item/item.model';
import User from '../user/user.model';
import { ClaimStatus, ItemStatus } from '../../common/types';
import { NotFoundError, ValidationError } from '../../common/errors';
import activityService from '../activity/activity.service';
import { ActivityAction } from '../../common/types';
import notificationService from '../notification/notification.service';
import { NotificationEvent } from '../../common/types';

class ClaimService {
  async createClaim(data: {
    itemId: string;
    claimantId: string;
    description: string;
    lostReportId?: string;
  }): Promise<IClaim> {
    // Check if item exists and is available
    const item = await Item.findById(data.itemId);

    if (!item) {
      throw new NotFoundError('Item not found');
    }

    if (item.status !== ItemStatus.AVAILABLE) {
      throw new ValidationError('Item is not available for claiming');
    }

    // Check for existing claims
    const existingClaim = await Claim.findOne({
      itemId: data.itemId,
      status: { $in: [ClaimStatus.FILED, ClaimStatus.IDENTITY_PROOF_REQUESTED, ClaimStatus.VERIFIED, ClaimStatus.PICKUP_BOOKED] },
    });

    if (existingClaim) {
      throw new ValidationError('Item already has an active claim');
    }

    const claim = await Claim.create(data);

    // Update item status
    item.status = ItemStatus.CLAIMED;
    item.claimedBy = claim.claimantId;
    await item.save();

    // Log activity
    await activityService.logActivity({
      action: ActivityAction.CLAIM_FILED,
      userId: data.claimantId,
      entityType: 'Claim',
      entityId: claim._id.toString(),
      metadata: {
        itemId: data.itemId,
      },
    });

    // Request proof
    await this.requestProof(claim._id.toString());

    return claim;
  }

  async getClaimById(claimId: string): Promise<IClaim> {
    const claim = await Claim.findById(claimId)
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

    if (!claim) {
      throw new NotFoundError('Claim not found');
    }

    return claim;
  }

  async getMyClaims(
    userId: string,
    filters: { status?: ClaimStatus; keyword?: string; itemId?: string; date?: string },
    pagination: { page: number; limit: number }
  ): Promise<{ data: IClaim[]; total: number }> {
    const query: any = { claimantId: userId };

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.itemId) {
      query.itemId = filters.itemId;
    }

    if (filters.date) {
        const startOfDay = new Date(filters.date);
        startOfDay.setHours(0, 0, 0, 0);
        
        const endOfDay = new Date(filters.date);
        endOfDay.setHours(23, 59, 59, 999);
        
        query.createdAt = {
          $gte: startOfDay,
          $lte: endOfDay
        };
    }

    if (filters.keyword) {
      const keywordRegex = new RegExp(filters.keyword, 'i');
      
      // Find matching items
      const matchingItems = await Item.find({
        $or: [
          { description: keywordRegex },
          { locationFound: keywordRegex }
        ]
      }).select('_id');
      const itemIds = matchingItems.map(item => item._id);

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
      .populate('itemId')
      .populate('lostReportId');

    return { data: claims, total };
  }

  async getAllClaims(
    filters: { status?: ClaimStatus; keyword?: string; itemId?: string; date?: string },
    pagination: { page: number; limit: number }
  ): Promise<{ data: IClaim[]; total: number }> {
    const query: Record<string, unknown> = {};
    
    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.itemId) {
      query.itemId = filters.itemId;
    }

    if (filters.keyword) {
      const keywordRegex = new RegExp(filters.keyword, 'i');
      
      // Find matching items
      const matchingItems = await Item.find({
        $or: [
          { description: keywordRegex },
          { locationFound: keywordRegex }
        ]
      }).select('_id');
      const itemIds = matchingItems.map(item => item._id);

      // Find matching users (claimants)
      const matchingUsers = await User.find({
        $or: [
          { name: keywordRegex },
          { email: keywordRegex }
        ]
      }).select('_id');
      const userIds = matchingUsers.map(user => user._id);

      query.$or = [
        { description: keywordRegex }, // Claim description
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
        
        query.createdAt = {
          $gte: startOfDay,
          $lte: endOfDay
        };
    }

    const total = await Claim.countDocuments(query);

    const claims = await Claim.find(query)
      .sort({ createdAt: -1 })
      .skip((pagination.page - 1) * pagination.limit)
      .limit(pagination.limit)
      .populate('itemId')
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

    if (!claim) {
      throw new NotFoundError('Claim not found or unauthorized');
    }

    if (claim.status !== ClaimStatus.IDENTITY_PROOF_REQUESTED) {
      throw new ValidationError('Claim is not in proof request state');
    }

    claim.proofDocuments.push(
      ...proofDocuments.map((doc) => ({
        ...doc,
        uploadedAt: new Date(),
      }))
    );
    await claim.save();

    // Log activity
    await activityService.logActivity({
      action: ActivityAction.PROOF_UPLOADED,
      userId,
      entityType: 'Claim',
      entityId: claimId,
      metadata: {
        documentCount: proofDocuments.length,
      },
    });

    return claim;
  }

  async verifyClaim(
    claimId: string,
    verifierId: string,
    notes?: string
  ): Promise<IClaim> {
    const claim = await Claim.findById(claimId);

    if (!claim) {
      throw new NotFoundError('Claim not found');
    }

    if (claim.proofDocuments.length === 0) {
      throw new ValidationError('No proof documents uploaded');
    }

    claim.status = ClaimStatus.VERIFIED;
    claim.verifiedBy = verifierId as never;
    claim.verifiedAt = new Date();
    claim.verificationNotes = notes;
    await claim.save();

    // Log activity
    await activityService.logActivity({
      action: ActivityAction.CLAIM_VERIFIED,
      userId: verifierId,
      entityType: 'Claim',
      entityId: claimId,
      metadata: {
        claimantId: claim.claimantId.toString(),
      },
    });

    // Notify claimant
    await notificationService.queueNotification({
      event: NotificationEvent.CLAIM_STATUS_UPDATE,
      userId: claim.claimantId.toString(),
      data: {
        claimId,
        status: ClaimStatus.VERIFIED,
        notes,
      },
    });

    return claim;
  }

  async rejectClaim(
    claimId: string,
    verifierId: string,
    reason: string
  ): Promise<IClaim> {
    const claim = await Claim.findById(claimId).populate('itemId');

    if (!claim) {
      throw new NotFoundError('Claim not found');
    }

    claim.status = ClaimStatus.REJECTED;
    claim.verifiedBy = verifierId as never;
    claim.verifiedAt = new Date();
    claim.rejectionReason = reason;
    await claim.save();

    // Revert item status
    const item = await Item.findById(claim.itemId);
    if (item) {
      item.status = ItemStatus.AVAILABLE;
      item.claimedBy = undefined;
      await item.save();
    }

    // Log activity
    await activityService.logActivity({
      action: ActivityAction.CLAIM_REJECTED,
      userId: verifierId,
      entityType: 'Claim',
      entityId: claimId,
      metadata: {
        reason,
      },
    });

    // Notify claimant
    await notificationService.queueNotification({
      event: NotificationEvent.CLAIM_STATUS_UPDATE,
      userId: claim.claimantId.toString(),
      data: {
        claimId,
        status: ClaimStatus.REJECTED,
        notes: reason,
      },
    });

    return claim;
  }

  async updateClaimStatus(
    claimId: string,
    status: ClaimStatus
  ): Promise<IClaim> {
    const claim = await Claim.findById(claimId);

    if (!claim) {
      throw new NotFoundError('Claim not found');
    }

    claim.status = status;
    await claim.save();

    return claim;
  }

  private async requestProof(claimId: string): Promise<void> {
    const claim = await Claim.findById(claimId);

    if (!claim) {
      return;
    }

    claim.status = ClaimStatus.IDENTITY_PROOF_REQUESTED;
    await claim.save();

    // Notify claimant
    await notificationService.queueNotification({
      event: NotificationEvent.PROOF_REQUESTED,
      userId: claim.claimantId.toString(),
      data: {
        claimId,
      },
    });
  }
}

export default new ClaimService();
