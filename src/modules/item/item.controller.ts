import { Request, Response } from 'express';
import { asyncHandler } from '../../common/helpers/asyncHandler';
import { AuthenticatedRequest, MulterRequest } from '../../common/types';
import itemService from './item.service';
import { ItemStatus } from '../../common/types';
import { FilterQuery } from 'mongoose';
import { IItem } from './item.model';

/**
 * @swagger
 * tags:
 *   name: Items
 *   description: Lost & Found Item Management
 */
class ItemController {
  /**
   * @swagger
   * /api/items:
   *   post:
   *     summary: Register a new found item
   *     tags: [Items]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         multipart/form-data:
   *           schema:
   *             type: object
   *             required:
   *               - category
   *               - description
   *               - locationFound
   *               - dateFound
   *             properties:
   *               category:
   *                 type: string
   *               description:
   *                 type: string
   *               locationFound:
   *                 type: string
   *               dateFound:
   *                 type: string
   *                 format: date-time
   *               isHighValue:
   *                 type: boolean
   *               estimatedValue:
   *                 type: number
   *               photos:
   *                 type: array
   *                 items:
   *                   type: string
   *                   format: binary
   *     responses:
   *       201:
   *         description: Item registered successfully
   */
  createItem = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const {
        category,
        description,
        locationFound,
        dateFound,
        isHighValue,
        estimatedValue,
        contactEmail,
        contactPhone,
      } = req.body;

      const multerFiles = (req as MulterRequest).files || [];
      
      // Map to UploadedFile interface
      const photos = multerFiles.map(file => ({
        filename: file.filename,
        originalName: file.originalname,
        path: file.path,
        mimetype: file.mimetype,
        size: file.size,
        uploadedAt: new Date(),
      }));

      const item = await itemService.createItem({
        category,
        description,
        photos,
        locationFound,
        dateFound: new Date(dateFound),
        registeredBy: req.user!.id,
        isHighValue,
        estimatedValue,
        finderContact: {
          email: contactEmail,
          phone: contactPhone,
        },
      });

      res.status(201).json({
        success: true,
        message: 'Item registered successfully',
        data: item,
      });
    }
  );

  /**
   * @swagger
   * /api/items:
   *   get:
   *     summary: Search and filter items
   *     tags: [Items]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: category
   *         schema:
   *           type: string
   *       - in: query
   *         name: status
   *         schema:
   *           type: string
   *       - in: query
   *         name: location
   *         schema:
   *           type: string
   *       - in: query
   *         name: keyword
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
   *         description: Items retrieved successfully
   */
  getItems = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { category, status, location, dateFoundFrom, dateFoundTo, keyword, page = 1, limit = 20 } = req.query;

      const result = await itemService.searchItems(
        {
          category: category as never,
          status: status as never,
          location: location as string,
          dateFoundFrom: dateFoundFrom ? new Date(dateFoundFrom as string) : undefined,
          dateFoundTo: dateFoundTo ? new Date(dateFoundTo as string) : undefined,
          keyword: keyword as string,
        },
        {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          sortBy: 'dateFound',
          sortOrder: 'desc',
        }
      );

      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    }
  );

  getItemById = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const item = await itemService.getItemById(req.params.id);

      res.json({
        success: true,
        data: item,
      });
    }
  );

  updateItemStatus = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { status } = req.body;

      const item = await itemService.updateItemStatus(
        req.params.id,
        status,
        req.user!.id
      );

      res.json({
        success: true,
        message: 'Item status updated',
        data: item,
      });
    }
  );

  assignStorage = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { storageLocationId } = req.body;

      const item = await itemService.assignStorage(req.params.id, storageLocationId);

      res.json({
        success: true,
        message: 'Storage location assigned',
        data: item,
      });
    }
  );

  searchPublicItems = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { category, location, dateFoundFrom, dateFoundTo, keyword, page = 1, limit = 20 } = req.query;

      // Only search AVAILABLE items for public
      const filter: FilterQuery<IItem> = { status: ItemStatus.AVAILABLE };

      if (category) filter.category = category;
      if (location) filter.locationFound = { $regex: location, $options: 'i' };
      
      if (dateFoundFrom || dateFoundTo) {
        filter.dateFound = {};
        if (dateFoundFrom) filter.dateFound.$gte = new Date(dateFoundFrom as string);
        if (dateFoundTo) filter.dateFound.$lte = new Date(dateFoundTo as string);
      }

      if (keyword) {
        filter.$or = [
          { description: { $regex: keyword, $options: 'i' } },
          { keywords: { $in: [new RegExp(keyword as string, 'i')] } },
          { locationFound: { $regex: keyword, $options: 'i' } }
        ];
      }

      // Reuse the service's searchItems but with the forced public filter
      // We process result to only return public-safe fields ideally, 
      // but for now relying on backend transformation or just sending as is (assuming no sensitive data in basic item model)
      // Item model has: registeredBy, finderName, finderContact - these are sensitive.
      // Ideally we should select fields. But ItemService.searchItems returns Mongoose docs or objects.
      
      const result = await itemService.searchItems(filter, {
           page: parseInt(page as string),
           limit: parseInt(limit as string),
           sortBy: 'dateFound',
           sortOrder: 'desc'
      });

      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination
      });
    }
  );
}

export default new ItemController();
