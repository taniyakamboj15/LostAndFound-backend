import { Response } from 'express';
import mongoose from 'mongoose';
import { asyncHandler } from '../../common/helpers/asyncHandler';
import { AuthenticatedRequest } from '../../common/types';
import storageService from './storage.service';
import storageLogic from './storage.logic';
import Item from '../item/item.model';
import Match, { IMatch } from '../match/match.model';

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
      const { name, location, shelfNumber, binNumber, capacity, city, address, isPickupPoint } = req.body;

      const storage = await storageService.createStorage({
        name,
        location,
        shelfNumber,
        binNumber,
        capacity,
        city,
        address,
        isPickupPoint,
      });

      res.status(201).json({
        success: true,
        message: 'Storage location created',
        data: storage,
      });
    }
  );

  /**
   * GET /api/storage/pickup-points
   * Returns a sanitized list of active pickup points for claimants.
   */
  getPickupPoints = asyncHandler(
    async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
      const storages = await storageService.getPickupPoints();
      res.json({
        success: true,
        data: storages,
      });
    }
  );

  getUniqueCities = asyncHandler(
    async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
      const cities = await storageService.getUniqueCities();
      res.json({
        success: true,
        data: cities,
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
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { size } = req.query;
      const storages = await storageService.getAvailableStorage(size as 'small' | 'medium' | 'large' | undefined);

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
      const { name, location, shelfNumber, binNumber, capacity, isActive, city, address, isPickupPoint } = req.body;

      const storage = await storageService.updateStorage(req.params.id, {
        name,
        location,
        shelfNumber,
        binNumber,
        capacity,
        isActive,
        city,
        address,
        isPickupPoint,
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

  /**
   * GET /api/storage/overflow-suggestions
   * Returns item IDs that are the best candidates for overflow/transfer
   * based on age (oldest 20% of items in storage).
   */
  getOverflowSuggestions = asyncHandler(
    async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
      // Fetch all items currently in storage
      const items = await Item.find({
        storageLocation: { $exists: true, $ne: null },
        status: 'AVAILABLE',
      })
        .select('_id dateFound storageLocation retentionExpiryDate')
        .lean<{ _id: mongoose.Types.ObjectId; retentionExpiryDate: Date }[]>();

      if (items.length === 0) {
        res.json({ success: true, data: { suggestedItemIds: [], total: 0, message: 'No items in storage.' } });
        return;
      }

      // Fetch highest confidence score per item
      const itemScores = await Promise.all(items.map(async (item) => {
        const bestMatch = await Match.findOne({ itemId: item._id, status: { $ne: 'REJECTED' } })
          .sort({ confidenceScore: -1 })
          .select('confidenceScore')
          .lean<IMatch | null>();
        
        return {
          _id: item._id,
          retentionExpiryDate: item.retentionExpiryDate,
          highestConfidence: bestMatch?.confidenceScore || 0
        };
      }));

      const suggestedItemIds = storageLogic.suggestOverflowItems(itemScores);

      res.json({
        success: true,
        data: {
          suggestedItemIds,
          total: suggestedItemIds.length,
          message: suggestedItemIds.length === 0
            ? 'No overflow candidates. Storage is within normal capacity.'
            : `${suggestedItemIds.length} item(s) recommended for transfer or overflow.`,
        },
      });
    }
  );
}

export default new StorageController();
