import { Response } from 'express';
import { asyncHandler } from '../../common/helpers/asyncHandler';
import { AuthenticatedRequest } from '../../common/types';
import dispositionService from './disposition.service';

/**
 * @swagger
 * tags:
 *   name: Dispositions
 *   description: Final handling of items (Donation, Disposal, etc.)
 */
class DispositionController {
  /**
   * @swagger
   * /api/dispositions:
   *   post:
   *     summary: Create a new disposition for an item
   *     tags: [Dispositions]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - itemId
   *               - type
   *             properties:
   *               itemId:
   *                 type: string
   *               type:
   *                 type: string
   *                 enum: [RETURNED, DONATED, AUCTIONED, DISPOSED, KEPT]
   *               recipient:
   *                 type: string
   *               notes:
   *                 type: string
   *     responses:
   *       201:
   *         description: Disposition created successfully
   */
  createDisposition = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { itemId, type, recipient, notes } = req.body;

      const disposition = await dispositionService.createDisposition({
        itemId,
        type,
        processedBy: req.user!.id,
        recipient,
        notes,
      });

      res.status(201).json({
        success: true,
        message: 'Disposition created successfully',
        data: disposition,
      });
    }
  );

  /**
   * @swagger
   * /api/dispositions:
   *   get:
   *     summary: Get all dispositions with filters
   *     tags: [Dispositions]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: type
   *         schema:
   *           type: string
   *       - in: query
   *         name: dateFrom
   *         schema:
   *           type: string
   *           format: date
   *       - in: query
   *         name: dateTo
   *         schema:
   *           type: string
   *           format: date
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
   *         description: Dispositions retrieved successfully
   */
  getAllDispositions = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { type, dateFrom, dateTo, page = 1, limit = 20 } = req.query;

      const result = await dispositionService.getAllDispositions(
        {
          type: type as never,
          dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
          dateTo: dateTo ? new Date(dateTo as string) : undefined,
        },
        {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
        }
      );

      res.json({
        success: true,
        data: result.data,
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total: result.total,
          totalPages: Math.ceil(result.total / parseInt(limit as string)),
        },
      });
    }
  );

  /**
   * @swagger
   * /api/dispositions/{id}:
   *   get:
   *     summary: Get disposition details by ID
   *     tags: [Dispositions]
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
   *         description: Disposition details retrieved successfully
   */
  getDispositionById = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const disposition = await dispositionService.getDispositionById(req.params.id);

      res.json({
        success: true,
        data: disposition,
      });
    }
  );

  /**
   * @swagger
   * /api/dispositions/expired:
   *   get:
   *     summary: Get items whose retention period has expired
   *     tags: [Dispositions]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Expired items retrieved successfully
   */
  getExpiredItems = asyncHandler(
    async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
      const items = await dispositionService.getExpiredItems();

      res.json({
        success: true,
        data: items,
      });
    }
  );

  /**
   * @swagger
   * /api/dispositions/{id}/audit:
   *   post:
   *     summary: Add an audit entry to a disposition
   *     tags: [Dispositions]
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
   *               - action
   *               - details
   *             properties:
   *               action:
   *                 type: string
   *               details:
   *                 type: string
   *     responses:
   *       200:
   *         description: Audit entry added
   */
  addAuditEntry = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { action, details } = req.body;

      const disposition = await dispositionService.addAuditEntry(
        req.params.id,
        req.user!.id,
        action,
        details
      );

      res.json({
        success: true,
        message: 'Audit entry added',
        data: disposition,
      });
    }
  );
}

export default new DispositionController();
