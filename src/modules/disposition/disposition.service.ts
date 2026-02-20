import Disposition, { IDisposition } from './disposition.model';
import Item from '../item/item.model';
import { DispositionType, ItemStatus } from '../../common/types';
import { NotFoundError, ValidationError } from '../../common/errors';
import activityService from '../activity/activity.service';
import { ActivityAction } from '../../common/types';
import storageService from '../storage/storage.service';

class DispositionService {
  async createDisposition(data: {
    itemId: string;
    type: DispositionType;
    processedBy: string;
    recipient?: string;
    notes?: string;
  }): Promise<IDisposition> {
  
    const item = await Item.findById(data.itemId);

    if (!item) {
      throw new NotFoundError('Item not found');
    }

    if (item.status !== ItemStatus.AVAILABLE) {
      throw new ValidationError('Only available items can be disposed');
    }

    if (new Date() < item.retentionExpiryDate) {
      throw new ValidationError('Item retention period has not expired yet');
    }

    // Check if disposition already exists
    const existingDisposition = await Disposition.findOne({
      itemId: data.itemId,
    });

    if (existingDisposition) {
      throw new ValidationError('Disposition already exists for this item');
    }

    const disposition = await Disposition.create({
      ...data,
      processedAt: new Date(),
      auditTrail: [
        {
          action: 'DISPOSITION_INITIATED',
          timestamp: new Date(),
          userId: data.processedBy as never,
          details: `Disposition type: ${data.type}`,
        },
      ],
    });

    item.status = ItemStatus.DISPOSED;
   
    if (item.storageLocation) {
      try {
        const size = (item.itemSize?.toLowerCase() || 'medium') as 'small' | 'medium' | 'large';
        await storageService.removeItemFromStorage(item.storageLocation.toString(), size);
        item.storageLocation = undefined;
      } catch (error) {
         console.error('Error removing from storage during disposition:', error);
      }
    }

    await item.save();

    // Finalize audit record
    disposition.auditTrail.push({
      action: 'DISPOSITION_COMPLETED',
      timestamp: new Date(),
      userId: data.processedBy as never,
      details: `Item ${data.itemId} status moved to DISPOSED. Storage cleared.`,
    });
    await disposition.save();

    // Log activity
    await activityService.logActivity({
      action: ActivityAction.DISPOSITION_PROCESSED,
      userId: data.processedBy,
      entityType: 'Disposition',
      entityId: disposition._id.toString(),
      metadata: {
        itemId: data.itemId,
        type: data.type,
        recipient: data.recipient,
      },
    });

    return disposition;
  }

  async getDispositionById(dispositionId: string): Promise<IDisposition> {
    const disposition = await Disposition.findById(dispositionId)
      .populate('itemId')
      .populate('processedBy', 'name email')
      .populate('auditTrail.userId', 'name email');

    if (!disposition) {
      throw new NotFoundError('Disposition not found');
    }

    return disposition;
  }

  async getDispositionByItemId(itemId: string): Promise<IDisposition | null> {
    return Disposition.findOne({ itemId })
      .populate('processedBy', 'name email')
      .populate('auditTrail.userId', 'name email');
  }

  async getAllDispositions(
    filters: { type?: DispositionType; dateFrom?: Date; dateTo?: Date },
    pagination: { page: number; limit: number }
  ): Promise<{ data: IDisposition[]; total: number }> {
    const query: Record<string, unknown> = {};

    if (filters.type) {
      query.type = filters.type;
    }

    if (filters.dateFrom || filters.dateTo) {
      query.processedAt = {};
      if (filters.dateFrom) {
        (query.processedAt as Record<string, unknown>).$gte = filters.dateFrom;
      }
      if (filters.dateTo) {
        (query.processedAt as Record<string, unknown>).$lte = filters.dateTo;
      }
    }

    const total = await Disposition.countDocuments(query);

    const dispositions = await Disposition.find(query)
      .sort({ processedAt: -1 })
      .skip((pagination.page - 1) * pagination.limit)
      .limit(pagination.limit)
      .populate('itemId')
      .populate('processedBy', 'name email');

    return { data: dispositions, total };
  }

  async addAuditEntry(
    dispositionId: string,
    userId: string,
    action: string,
    details: string
  ): Promise<IDisposition> {
    const disposition = await Disposition.findById(dispositionId);

    if (!disposition) {
      throw new NotFoundError('Disposition not found');
    }

    disposition.auditTrail.push({
      action,
      timestamp: new Date(),
      userId: userId as never,
      details,
    });

    await disposition.save();

    return disposition;
  }

  async getExpiredItems(): Promise<
    Array<{ _id: string; category: string; locationFound: string; retentionExpiryDate: Date }>
  > {
    const items = await Item.find({
      status: ItemStatus.AVAILABLE,
      retentionExpiryDate: { $lte: new Date() },
    }).select('category locationFound retentionExpiryDate');

    return items.map((item) => ({
      _id: item._id.toString(),
      category: item.category,
      locationFound: item.locationFound,
      retentionExpiryDate: item.retentionExpiryDate,
    }));
  }
}

export default new DispositionService();
