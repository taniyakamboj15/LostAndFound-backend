import { Request, Response } from 'express';
import { asyncHandler } from '../../common/helpers/asyncHandler';
import { AuthenticatedRequest, MulterRequest, ItemCategory } from '../../common/types';
import itemService from './item.service';

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
        identifyingFeatures,
      } = req.body;

      const multerFiles = (req as MulterRequest).files || [];
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
        identifyingFeatures: typeof identifyingFeatures === 'string' 
          ? identifyingFeatures.split(',').map((f: string) => f.trim()).filter((f: string) => f.length > 0)
          : identifyingFeatures,
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

  /**
   * @swagger
   * /api/items/{id}:
   *   get:
   *     summary: Get item details by ID
   *     tags: [Items]
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
   *         description: Item details retrieved successfully
   */
  getItemById = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const item = await itemService.getItemById(req.params.id);

      res.json({
        success: true,
        data: item,
      });
    }
  );

  /**
   * @swagger
   * /api/items/{id}/status:
   *   patch:
   *     summary: Update item status
   *     tags: [Items]
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
   *             required:
   *               - status
   *             properties:
   *               status:
   *                 type: string
   *                 enum: [AVAILABLE, CLAIM_FILED, VERIFIED, PICKED_UP, DISPOSED, AUCTIONED, DONATED]
   *     responses:
   *       200:
   *         description: Item status updated successfully
   */
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

  /**
   * @swagger
   * /api/items/{id}/storage:
   *   patch:
   *     summary: Assign storage location to an item
   *     tags: [Items]
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
   *             required:
   *               - storageLocationId
   *             properties:
   *               storageLocationId:
   *                 type: string
   *     responses:
   *       200:
   *         description: Storage location assigned successfully
   */
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

  /**
   * @swagger
   * /api/items/public/search:
   *   get:
   *     summary: Publicly search found items
   *     tags: [Items]
   *     parameters:
   *       - in: query
   *         name: category
   *         schema:
   *           type: string
   *       - in: query
   *         name: location
   *         schema:
   *           type: string
   *       - in: query
   *         name: dateFoundFrom
   *         schema:
   *           type: string
   *           format: date
   *       - in: query
   *         name: dateFoundTo
   *         schema:
   *           type: string
   *           format: date
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
   *         description: Public items retrieved successfully
   */
  searchPublicItems = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { category, location, dateFoundFrom, dateFoundTo, keyword, page = 1, limit = 20 } = req.query;

      const result = await itemService.publicSearchItems(
        {
          category: category as ItemCategory,
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
}

export default new ItemController();
