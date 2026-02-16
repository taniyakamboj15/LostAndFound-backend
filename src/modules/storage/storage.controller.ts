import { Response } from 'express';
import { asyncHandler } from '../../common/helpers/asyncHandler';
import { AuthenticatedRequest } from '../../common/types';
import storageService from './storage.service';

class StorageController {
  createStorage = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { name, location, shelfNumber, binNumber, capacity } = req.body;

      const storage = await storageService.createStorage({
        name,
        location,
        shelfNumber,
        binNumber,
        capacity,
      });

      res.status(201).json({
        success: true,
        message: 'Storage location created',
        data: storage,
      });
    }
  );

  getAllStorage = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { isActive, page = 1, limit = 20 } = req.query;

      const result = await storageService.getAllStorage(
        { isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined },
        {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          sortBy: 'name',
          sortOrder: 'asc',
        }
      );

      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    }
  );

  getAvailableStorage = asyncHandler(
    async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
      const storages = await storageService.getAvailableStorage();

      res.json({
        success: true,
        data: storages,
      });
    }
  );

  getStorageById = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const storage = await storageService.getStorageById(req.params.id);

      res.json({
        success: true,
        data: storage,
      });
    }
  );

  updateStorage = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { name, location, shelfNumber, binNumber, capacity, isActive } = req.body;

      const storage = await storageService.updateStorage(req.params.id, {
        name,
        location,
        shelfNumber,
        binNumber,
        capacity,
        isActive,
      });

      res.json({
        success: true,
        message: 'Storage updated successfully',
        data: storage,
      });
    }
  );

  deleteStorage = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      await storageService.deleteStorage(req.params.id);

      res.json({
        success: true,
        message: 'Storage deleted successfully',
      });
    }
  );
}

export default new StorageController();
