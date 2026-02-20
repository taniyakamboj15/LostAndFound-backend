import mongoose, { Types, FilterQuery } from 'mongoose';
import Transfer, { ITransfer } from './transfer.model';
import Claim from '../claim/claim.model';
import Item from '../item/item.model';
import User from '../user/user.model';
import { 
  ClaimStatus, 
  TransferStatus, 
  ActivityAction,
  NotificationEvent, 
  IStorageModel, 
  IItemModel,
  PaginationParams,
  PaginatedResponse,
  TransferSearchFilters
} from '../../common/types';
import activityService from '../activity/activity.service';
import notificationService from '../notification/notification.service';
import { NotFoundError } from '../../common/errors';

class TransferService {
  private async getSystemUserId(): Promise<string> {
    const systemAdmin = await User.findOne({ role: 'ADMIN' }, '_id').lean();
    return systemAdmin ? systemAdmin._id.toString() : new Types.ObjectId().toString();
  }

  /**
   * Status change side effects map
   */
  private readonly statusEffectMap: Record<string, (transfer: ITransfer, session?: mongoose.ClientSession) => Promise<void>> = {
    [TransferStatus.PENDING]: async (transfer: ITransfer, session) => {
      await Claim.findByIdAndUpdate(transfer.claimId, { status: ClaimStatus.AWAITING_TRANSFER }).session(session || null);
    },
    [TransferStatus.RECOVERY_REQUIRED]: async (transfer: ITransfer, session) => {
      await Claim.findByIdAndUpdate(transfer.claimId, { status: ClaimStatus.AWAITING_RECOVERY }).session(session || null);
    },
    [TransferStatus.IN_TRANSIT]: async (transfer: ITransfer, session) => {
      transfer.shippedAt = new Date();
      await Claim.findByIdAndUpdate(transfer.claimId, { status: ClaimStatus.IN_TRANSIT }).session(session || null);
      
      // Notify claimant (async)
      const claim = await Claim.findById(transfer.claimId).populate('claimantId preferredPickupLocation').session(session || null);
      if (claim) {
        const dest = claim.preferredPickupLocation as unknown as IStorageModel;
        const destinationName = dest?.name || dest?.city || 'the pickup point';
        
        notificationService.queueNotification({
          event: NotificationEvent.TRANSFER_SENT,
          userId: claim.claimantId?.toString(),
          data: {
            claimId: claim._id,
            itemDescription: 'your item',
            carrierInfo: transfer.carrierInfo,
            destinationName
          }
        }).catch(err => console.error('Failed to notify transfer sent:', err));
      }

      await activityService.logActivity({
        action: ActivityAction.TRANSFER_IN_TRANSIT,
        userId: transfer.updatedBy ? transfer.updatedBy.toString() : await this.getSystemUserId(),
        entityType: 'Transfer',
        entityId: transfer._id.toString(),
      });
    },
    [TransferStatus.ARRIVED]: async (transfer: ITransfer, session) => {
      transfer.receivedAt = new Date();
      await Claim.findByIdAndUpdate(transfer.claimId, { status: ClaimStatus.ARRIVED }).session(session || null);
      
      await Item.findByIdAndUpdate(transfer.itemId, { 
        storageLocation: transfer.toStorageId, 
      }).session(session || null);

      // Notify claimant
      const claim = await Claim.findById(transfer.claimId).populate('claimantId preferredPickupLocation').session(session || null);
      if (claim) {
        const dest = claim.preferredPickupLocation as unknown as IStorageModel;
        const destinationName = dest?.name || dest?.city || 'the pickup point';

        notificationService.queueNotification({
          event: NotificationEvent.TRANSFER_ARRIVED,
          userId: claim.claimantId?.toString(),
          recipientEmail: claim.isAnonymous ? claim.email : undefined,
          data: {
            claimId: claim._id.toString(),
            itemDescription: (claim.itemId as unknown as IItemModel)?.description || 'your item',
            locationName: destinationName,
            destinationName,
            token: claim.isAnonymous ? claim.claimToken : undefined
          }
        }).catch(err => console.error('Failed to notify transfer arrived:', err));
      }

      await activityService.logActivity({
        action: ActivityAction.TRANSFER_ARRIVED,
        userId: transfer.updatedBy ? transfer.updatedBy.toString() : await this.getSystemUserId(),
        entityType: 'Transfer',
        entityId: transfer._id.toString(),
      });
    },
  };

  async createTransfer(data: {
    claimId: string;
    itemId: string;
    fromStorageId: string;
    toStorageId: string;
    status: TransferStatus;
    notes?: string;
    createdBy?: string;
  }) {
    const transfer = await Transfer.create(data);
    
    await activityService.logActivity({
      action: ActivityAction.TRANSFER_STARTED,
      userId: data.createdBy || await this.getSystemUserId(),
      entityType: 'Transfer',
      entityId: transfer._id.toString(),
    });

    return transfer;
  }

  async updateTransferStatus(transferId: string, status: TransferStatus, options: { updatedBy: string; carrierInfo?: string; notes?: string }) {
    const session = await mongoose.startSession();
    try {
      return await session.withTransaction(async () => {
        const transfer = await Transfer.findById(transferId).session(session);
        if (!transfer) throw new NotFoundError('Transfer not found');

        transfer.status = status;
        if (options.updatedBy) {
          transfer.updatedBy = new Types.ObjectId(options.updatedBy);
        }
        if (options.carrierInfo) transfer.carrierInfo = options.carrierInfo;
        if (options.notes) transfer.notes = options.notes;

        const effect = this.statusEffectMap[status];
        if (effect) {
          await effect(transfer, session);
        }

        return transfer.save({ session });
      });
    } finally {
      await session.endSession();
    }
  }

  async getTransfers(rawFilters: TransferSearchFilters = {}, pagination: PaginationParams = { page: 1, limit: 10 }): Promise<PaginatedResponse<ITransfer>> {
    const filters: FilterQuery<ITransfer> = {};
    
    if (rawFilters.status) filters.status = rawFilters.status;
    if (rawFilters.fromStorageId) filters.fromStorageId = rawFilters.fromStorageId;
    if (rawFilters.toStorageId) filters.toStorageId = rawFilters.toStorageId;
    if (rawFilters.claimId) filters.claimId = rawFilters.claimId;
    
    if (rawFilters.keyword) {
      filters.$or = [
        { carrierInfo: { $regex: rawFilters.keyword, $options: 'i' } },
        { notes: { $regex: rawFilters.keyword, $options: 'i' } }
      ];
    }

    const total = await Transfer.countDocuments(filters);
    const totalPages = Math.ceil(total / pagination.limit);

    const transfers = await Transfer.find(filters)
      .populate('claimId')
      .populate('itemId')
      .populate('fromStorageId')
      .populate('toStorageId')
      .sort({ [pagination.sortBy || 'createdAt']: pagination.sortOrder === 'asc' ? 1 : -1 })
      .skip((pagination.page - 1) * pagination.limit)
      .limit(pagination.limit);

    return {
      data: transfers,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages
      }
    };
  }

  async getTransferById(id: string) {
    return Transfer.findById(id)
      .populate('claimId')
      .populate('itemId')
      .populate('fromStorageId')
      .populate('toStorageId');
  }

  async getTransferByClaimId(claimId: string) {
    return Transfer.findOne({ claimId })
      .populate('itemId')
      .populate('fromStorageId')
      .populate('toStorageId');
  }

  async getActiveTransfers() {
    return Transfer.find({ status: { $in: [TransferStatus.PENDING, TransferStatus.IN_TRANSIT] } })
      .populate('claimId')
      .populate('itemId')
      .populate('fromStorageId')
      .populate('toStorageId');
  }
}

export default new TransferService();
