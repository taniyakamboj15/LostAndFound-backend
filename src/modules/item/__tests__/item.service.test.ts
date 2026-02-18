import itemService from '../item.service';
import Item from '../item.model';
import storageService from '../../storage/storage.service';
import activityService from '../../activity/activity.service';
import * as matchQueue from '../../match/match.queue';
import { ItemCategory, ItemStatus } from '../../../common/types';

// Mock dependencies
jest.mock('../item.model');
jest.mock('../../storage/storage.service');
jest.mock('../../activity/activity.service');
jest.mock('../../match/match.queue');

describe('ItemService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('createItem', () => {
        it('should create an item and trigger side effects', async () => {
             const mockData = {
                category: ItemCategory.ELECTRONICS,
                description: 'Lost iPhone',
                locationFound: 'Terminal 1',
                dateFound: new Date(),
                registeredBy: 'user123',
                photos: [],
                isHighValue: true,
             };

             const mockCreatedItem = {
                 ...mockData,
                 _id: 'item123',
                 retentionPeriodDays: 60,
                 status: ItemStatus.AVAILABLE,
             };

             (Item.create as jest.Mock).mockResolvedValue(mockCreatedItem);
             // Mock side effects
             (activityService.logActivity as jest.Mock).mockResolvedValue({});
             (matchQueue.addMatchJob as jest.Mock).mockResolvedValue({});

             const result = await itemService.createItem(mockData as any);

             expect(Item.create).toHaveBeenCalled();
             expect(result).toHaveProperty('_id', 'item123');
             expect(activityService.logActivity).toHaveBeenCalled();
             expect(matchQueue.addMatchJob).toHaveBeenCalledWith({ type: 'ITEM_CREATED', id: 'item123' });
        });

        it('should validate storage capacity if location provided', async () => {
             const mockData = {
                category: ItemCategory.CLOTHING,
                description: 'Jacket',
                locationFound: 'Lobby',
                dateFound: new Date(),
                registeredBy: 'user123',
                photos: [],
                storageLocation: 'storage1',
             };

            const mockStorage = {
                _id: 'storage1',
                isActive: true,
                currentCount: 10,
                capacity: 100,
                name: 'Main Storage',
            };

            (storageService.getStorageById as jest.Mock).mockResolvedValue(mockStorage);
            (Item.create as jest.Mock).mockResolvedValue({ ...mockData, _id: 'item123' });
            (storageService.assignItemToStorage as jest.Mock).mockResolvedValue({});
            // Improved mock for chained mongoose calls
            const mockQuery = {
                populate: jest.fn().mockReturnThis(),
                then: function(resolve: any) { resolve({ ...mockData, _id: 'item123' }); }
            };
            (Item.findById as jest.Mock).mockReturnValue(mockQuery);

            await itemService.createItem(mockData as any);

            expect(storageService.getStorageById).toHaveBeenCalledWith('storage1');
            expect(storageService.assignItemToStorage).toHaveBeenCalledWith('item123', 'storage1');
        });
    });

    describe('getItemById', () => {
        it('should return item if found', async () => {
            const mockItem = { _id: 'item123', description: 'Test' };
            const mockQuery = {
                populate: jest.fn().mockReturnThis(),
                then: function(resolve: any) { resolve(mockItem); }
            };
            (Item.findById as jest.Mock).mockReturnValue(mockQuery);

            const result = await itemService.getItemById('item123');
            expect(result).toEqual(mockItem);
        });

        it('should throw NotFoundError if not found', async () => {
             const mockQuery = {
                populate: jest.fn().mockReturnThis(),
                then: function(resolve: any) { resolve(null); }
            };
            (Item.findById as jest.Mock).mockReturnValue(mockQuery);

            await expect(itemService.getItemById('item123')).rejects.toThrow('Item not found');
        });
    });
});
