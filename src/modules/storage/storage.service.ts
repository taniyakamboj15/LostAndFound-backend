import Storage, { IStorage } from './storage.model';
import Item from '../item/item.model';
import { Types, FilterQuery } from 'mongoose';
import { NotFoundError, ValidationError } from '../../common/errors';
import { PaginatedResponse, PaginationParams } from '../../common/types';

class StorageService {
  async createStorage(data: {
    name: string;
    location: string;
    shelfNumber?: string;
    binNumber?: string;
    capacity: { small: number; medium: number; large: number };
    city: string;
    address?: string;
    isPickupPoint: boolean;
  }): Promise<IStorage> {
    return Storage.create({
      ...data,
      currentCount: { small: 0, medium: 0, large: 0 }
    });
  }

  async getPickupPoints(): Promise<IStorage[]> {
    return Storage.find({ 
      isActive: true, 
      isPickupPoint: true 
    })
    .select('_id name city address isPickupPoint isActive')
    .sort({ city: 1, name: 1 });
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

  async getAvailableStorage(size?: 'small' | 'medium' | 'large'): Promise<IStorage[]> {
    const query: FilterQuery<IStorage> = { isActive: true };
    
    if (size) {
      query[`capacity.${size}`] = { $gt: 0 };
      query.$expr = { $lt: [`$currentCount.${size}`, `$capacity.${size}`] };
    } else {
      query.$or = [
        { $expr: { $lt: ['$currentCount.small', '$capacity.small'] } },
        { $expr: { $lt: ['$currentCount.medium', '$capacity.medium'] } },
        { $expr: { $lt: ['$currentCount.large', '$capacity.large'] } }
      ];
    }

    return Storage.find(query).sort({ name: 1 });
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

    // Update item
    const item = await Item.findById(itemId);
    if (!item) {
      throw new NotFoundError('Item not found');
    }

    const size = (item.itemSize?.toLowerCase() || 'medium') as 'small' | 'medium' | 'large';

    if (storage.currentCount[size] >= storage.capacity[size]) {
      throw new ValidationError(`Storage location is at full capacity for ${size} items`);
    }

    if (item.storageLocation) {
      await this.removeItemFromStorage(item.storageLocation.toString(), size);
    }

    item.storageLocation = new Types.ObjectId(storageId);
    await item.save();

    // Update storage count
    const updatePath = `currentCount.${size}`;
    await Storage.findByIdAndUpdate(storageId, { $inc: { [updatePath]: 1 } });

    return this.getStorageById(storageId);
  }

  async removeItemFromStorage(storageId: string, size: 'small' | 'medium' | 'large'): Promise<IStorage> {
    const updatePath = `currentCount.${size}`;
    const storage = await Storage.findOneAndUpdate(
      { _id: storageId, [`currentCount.${size}`]: { $gt: 0 } },
      { $inc: { [updatePath]: -1 } },
      { new: true }
    );

    if (!storage) {
      // If not found or count already 0, just return the current state
      return this.getStorageById(storageId);
    }

    return storage;
  }

  async updateStorage(
    storageId: string,
    data: Partial<Pick<IStorage, 'name' | 'location' | 'shelfNumber' | 'binNumber' | 'capacity' | 'isActive' | 'city' | 'address' | 'isPickupPoint'>>
  ): Promise<IStorage> {
    const storage = await Storage.findById(storageId);

    if (!storage) {
      throw new NotFoundError('Storage location not found');
    }

    if (data.capacity) {
      if (data.capacity.small !== undefined && data.capacity.small < storage.currentCount.small) {
        throw new ValidationError('Cannot reduce small capacity below current count');
      }
      if (data.capacity.medium !== undefined && data.capacity.medium < storage.currentCount.medium) {
        throw new ValidationError('Cannot reduce medium capacity below current count');
      }
      if (data.capacity.large !== undefined && data.capacity.large < storage.currentCount.large) {
        throw new ValidationError('Cannot reduce large capacity below current count');
      }
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

    if (storage.currentCount.small > 0 || storage.currentCount.medium > 0 || storage.currentCount.large > 0) {
      throw new ValidationError(
        'Cannot delete storage location with items. Please reassign items first.'
      );
    }

    await Storage.deleteOne({ _id: storageId });
  }

  async getUniqueCities(): Promise<string[]> {
    const cities = await Storage.distinct('city', { isActive: true });
    return cities.sort();
  }
}

export default new StorageService();
