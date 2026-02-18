import { Response } from 'express';
import { asyncHandler } from '../../common/helpers/asyncHandler';
import { AuthenticatedRequest } from '../../common/types';
import storageService from './storage.service';

/**
 * @swagger
 * tags:
 *   name: Storage
 *   description: Physical storage location management
 */
class StorageController {
  /**
   * @swagger
   * /api/storage:
   *   post:
   *     summary: Create a new storage location (Admin only)
   *     tags: [Storage]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - name
   *               - location
   *               - capacity
   *             properties:
   *               name:
   *                 type: string
   *               location:
   *                 type: string
   *               shelfNumber:
   *                 type: string
   *               binNumber:
   *                 type: string
   *               capacity:
   *                 type: integer
   *     responses:
   *       201:
   *         description: Storage location created
   */
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

  /**
   * @swagger
   * /api/storage:
   *   get:
   *     summary: Get all storage locations (Staff/Admin only)
   *     tags: [Storage]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: isActive
   *         schema:
   *           type: string
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           default: 1
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 20
   *     responses:
   *       200:
   *         description: Storage locations retrieved successfully
   */
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

  /**
   * @swagger
   * /api/storage/available:
   *   get:
   *     summary: Get storage locations with remaining capacity
   *     tags: [Storage]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Available storage locations retrieved
   */
  getAvailableStorage = asyncHandler(
    async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
      const storages = await storageService.getAvailableStorage();

      res.json({
        success: true,
        data: storages,
      });
    }
  );

  /**
   * @swagger
   * /api/storage/{id}:
   *   get:
   *     summary: Get storage location details by ID
   *     tags: [Storage]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Storage location details retrieved
   */
  getStorageById = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const storage = await storageService.getStorageById(req.params.id);

      res.json({
        success: true,
        data: storage,
      });
    }
  );

  /**
   * @swagger
   * /api/storage/{id}:
   *   patch:
   *     summary: Update a storage location
   *     tags: [Storage]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               name:
   *                 type: string
   *               location:
   *                 type: string
   *               shelfNumber:
   *                 type: string
   *               binNumber:
   *                 type: string
   *               capacity:
   *                 type: integer
   *               isActive:
   *                 type: boolean
   *     responses:
   *       200:
   *         description: Storage location updated successfully
   */
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

  /**
   * @swagger
   * /api/storage/{id}:
   *   delete:
   *     summary: Delete a storage location
   *     tags: [Storage]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Storage location deleted
   */
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
