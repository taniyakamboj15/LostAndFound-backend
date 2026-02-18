import Storage, { IStorage } from './storage.model';
import Item from '../item/item.model';
import { Types } from 'mongoose';
import { NotFoundError, ValidationError } from '../../common/errors';
import { PaginatedResponse, PaginationParams } from '../../common/types';

class StorageService {
  async createStorage(data: {
    name: string;
    location: string;
    shelfNumber?: string;
    binNumber?: string;
    capacity: number;
  }): Promise<IStorage> {
    return Storage.create(data);
  }

  async getStorageById(storageId: string): Promise<IStorage> {
    const storage = await Storage.findById(storageId);

    if (!storage) {
      throw new NotFoundError('Storage location not found');
    }

    return storage;
  }

  async getAllStorage(
    filters: { isActive?: boolean },
    pagination: PaginationParams
  ): Promise<PaginatedResponse<IStorage>> {
    const query: Record<string, unknown> = {};

    if (filters.isActive !== undefined) {
      query.isActive = filters.isActive;
    }

    const total = await Storage.countDocuments(query);
    const totalPages = Math.ceil(total / pagination.limit);

    const storages = await Storage.find(query)
      .sort({ name: 1 })
      .skip((pagination.page - 1) * pagination.limit)
      .limit(pagination.limit);

    return {
      data: storages,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages,
      },
    };
  }

  async getAvailableStorage(): Promise<IStorage[]> {
    return Storage.find({
      isActive: true,
      $expr: { $lt: ['$currentCount', '$capacity'] },
    }).sort({ currentCount: 1 });
  }

  async assignItemToStorage(
    itemId: string,
    storageId: string
  ): Promise<IStorage> {
    const storage = await Storage.findById(storageId);

    if (!storage) {
      throw new NotFoundError('Storage location not found');
    }

    if (!storage.isActive) {
      throw new ValidationError('Storage location is inactive');
    }

    if (storage.currentCount >= storage.capacity) {
      throw new ValidationError('Storage location is at full capacity');
    }

    // Update item
    const item = await Item.findById(itemId);
    if (!item) {
      throw new NotFoundError('Item not found');
    }

    if (item.storageLocation) {
      await this.removeItemFromStorage(item.storageLocation.toString());
    }

    item.storageLocation = new Types.ObjectId(storageId);
    await item.save();

    // Update storage count
    storage.currentCount += 1;
    await storage.save();

    return storage;
  }

  async removeItemFromStorage(storageId: string): Promise<IStorage> {
    const storage = await Storage.findById(storageId);

    if (!storage) {
      throw new NotFoundError('Storage location not found');
    }

    if (storage.currentCount > 0) {
      storage.currentCount -= 1;
      await storage.save();
    }

    return storage;
  }

  async updateStorage(
    storageId: string,
    data: Partial<Pick<IStorage, 'name' | 'location' | 'shelfNumber' | 'binNumber' | 'capacity' | 'isActive'>>
  ): Promise<IStorage> {
    const storage = await Storage.findById(storageId);

    if (!storage) {
      throw new NotFoundError('Storage location not found');
    }

    if (data.capacity !== undefined && data.capacity < storage.currentCount) {
      throw new ValidationError(
        'Cannot reduce capacity below current item count'
      );
    }

    Object.assign(storage, data);
    await storage.save();

    return storage;
  }

  async deleteStorage(storageId: string): Promise<void> {
    const storage = await Storage.findById(storageId);

    if (!storage) {
      throw new NotFoundError('Storage location not found');
    }

    if (storage.currentCount > 0) {
      throw new ValidationError(
        'Cannot delete storage location with items. Please reassign items first.'
      );
    }

    await Storage.deleteOne({ _id: storageId });
  }
}

export default new StorageService();
