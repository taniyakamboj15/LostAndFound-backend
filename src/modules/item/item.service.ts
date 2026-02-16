import { addDays } from 'date-fns';
import Item, { IItem } from './item.model';
import {
  ItemStatus,
  ItemCategory,
  ItemSearchFilters,
  PaginatedResponse,
  PaginationParams,
  UploadedFile,
} from '../../common/types';
import { NotFoundError, ValidationError } from '../../common/errors';
import activityService from '../activity/activity.service';
import { ActivityAction } from '../../common/types';

interface CreateItemData {
  category: ItemCategory;
  description: string;
  photos: UploadedFile[];
  locationFound: string;
  dateFound: Date;
  registeredBy: string;
  isHighValue?: boolean;
  estimatedValue?: number;
  finderContact?: {
    email?: string;
    phone?: string;
  };
}

class ItemService {
  async createItem(data: CreateItemData): Promise<IItem> {
    const retentionPeriodDays = this.calculateRetentionPeriod(
      data.category,
      data.isHighValue
    );

    const retentionExpiryDate = addDays(new Date(), retentionPeriodDays);

    const photos = data.photos.map((file) => ({
      filename: file.filename,
      originalName: file.originalName,
      path: file.path.replace(/\\/g, '/'),
      mimetype: file.mimetype,
      size: file.size,
      uploadedAt: new Date(),
    }));

    const item = await Item.create({
      ...data,
      photos,
      retentionPeriodDays,
      retentionExpiryDate,
      finderContact: data.finderContact,
    });

    // Log activity
    await activityService.logActivity({
      action: ActivityAction.ITEM_REGISTERED,
      userId: data.registeredBy,
      entityType: 'Item',
      entityId: item._id.toString(),
      metadata: {
        category: item.category,
        locationFound: item.locationFound,
      },
    });

    return item;
  }

  async getItemById(itemId: string): Promise<IItem> {
    const item = await Item.findById(itemId)
      .populate('registeredBy', 'name email')
      .populate('storageLocation')
      .populate('claimedBy', 'name email');

    if (!item) {
      throw new NotFoundError('Item not found');
    }

    return item;
  }

  async searchItems(
    filters: ItemSearchFilters,
    pagination: PaginationParams
  ): Promise<PaginatedResponse<IItem>> {
    const query: Record<string, unknown> = {};

    if (filters.category) {
      query.category = filters.category;
    }

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.location) {
      query.locationFound = new RegExp(filters.location, 'i');
    }

    if (filters.dateFoundFrom || filters.dateFoundTo) {
      query.dateFound = {};
      if (filters.dateFoundFrom) {
        (query.dateFound as Record<string, unknown>).$gte = filters.dateFoundFrom;
      }
      if (filters.dateFoundTo) {
        (query.dateFound as Record<string, unknown>).$lte = filters.dateFoundTo;
      }
    }

    if (filters.keyword) {
      query.$text = { $search: filters.keyword };
    }

    const total = await Item.countDocuments(query);
    const totalPages = Math.ceil(total / pagination.limit);

    const items = await Item.find(query)
      .sort({ [pagination.sortBy || 'dateFound']: pagination.sortOrder === 'asc' ? 1 : -1 })
      .skip((pagination.page - 1) * pagination.limit)
      .limit(pagination.limit)
      .populate('registeredBy', 'name')
      .populate('storageLocation', 'name location');

    return {
      data: items,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages,
      },
    };
  }

  async publicSearchItems(
    filters: ItemSearchFilters,
    pagination: PaginationParams
  ): Promise<PaginatedResponse<Partial<IItem>>> {
    const result = await this.searchItems(
      { ...filters, status: ItemStatus.AVAILABLE },
      pagination
    );

    // Hide sensitive information
    const sanitizedData = result.data.map((item) => ({
      _id: item._id,
      category: item.category,
      description: this.sanitizeDescription(item.description),
      locationFound: item.locationFound,
      dateFound: item.dateFound,
      photos: item.photos.slice(0, 1), // Only first photo
    }));

    return {
      data: sanitizedData as never,
      pagination: result.pagination,
    };
  }

  async updateItemStatus(
    itemId: string,
    status: ItemStatus,
    userId: string
  ): Promise<IItem> {
    const item = await Item.findById(itemId);

    if (!item) {
      throw new NotFoundError('Item not found');
    }

    // Validate status transition
    this.validateStatusTransition(item.status, status);

    item.status = status;
    await item.save();

    // Log activity
    await activityService.logActivity({
      action: ActivityAction.ITEM_UPDATED,
      userId,
      entityType: 'Item',
      entityId: itemId,
      metadata: {
        oldStatus: item.status,
        newStatus: status,
      },
    });

    return item;
  }

  async assignStorage(
    itemId: string,
    storageLocationId: string
  ): Promise<IItem> {
    // Delegate to StorageService to ensure counts are updated
    // We need to dynamically import StorageService to avoid circular dependency issues if any
    const { default: storageService } = await import('../storage/storage.service');
    
    await storageService.assignItemToStorage(itemId, storageLocationId);
    
    // Fetch and return the updated item
    return this.getItemById(itemId);
  }

  async getExpiringItems(daysThreshold: number = 7): Promise<IItem[]> {
    const thresholdDate = addDays(new Date(), daysThreshold);

    return Item.find({
      status: ItemStatus.AVAILABLE,
      retentionExpiryDate: { $lte: thresholdDate, $gte: new Date() },
    }).populate('registeredBy', 'name email');
  }

  private calculateRetentionPeriod(
    category: ItemCategory,
    isHighValue?: boolean
  ): number {
    if (isHighValue) {
      return parseInt(process.env.RETENTION_PERIOD_HIGH_VALUE || '60');
    }

    if (category === ItemCategory.DOCUMENTS) {
      return parseInt(process.env.RETENTION_PERIOD_DOCUMENTS || '90');
    }

    return parseInt(process.env.RETENTION_PERIOD_DEFAULT || '30');
  }

  private validateStatusTransition(
    currentStatus: ItemStatus,
    newStatus: ItemStatus
  ): void {
    const validTransitions: Record<ItemStatus, ItemStatus[]> = {
      [ItemStatus.AVAILABLE]: [ItemStatus.CLAIMED, ItemStatus.DISPOSED],
      [ItemStatus.CLAIMED]: [ItemStatus.RETURNED, ItemStatus.AVAILABLE],
      [ItemStatus.RETURNED]: [],
      [ItemStatus.DISPOSED]: [],
    };

    if (!validTransitions[currentStatus].includes(newStatus)) {
      throw new ValidationError(
        `Invalid status transition from ${currentStatus} to ${newStatus}`
      );
    }
  }

  private sanitizeDescription(description: string): string {
    // Hide specific identifying details for public search
    return description.length > 100
      ? description.substring(0, 100) + '...'
      : description;
  }
}

export default new ItemService();
