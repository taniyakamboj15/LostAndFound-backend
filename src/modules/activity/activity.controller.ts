import { Response } from 'express';
import { asyncHandler } from '../../common/helpers/asyncHandler';
import { AuthenticatedRequest } from '../../common/types';
import activityService from './activity.service';

/**
 * @swagger
 * tags:
 *   name: Activity
 *   description: Audit logs and activity tracking
 */
class ActivityController {
  /**
   * @swagger
   * /api/activity:
   *   get:
   *     summary: Get all activities with filtering
   *     tags: [Activity]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: action
   *         schema:
   *           type: string
   *       - in: query
   *         name: userId
   *         schema:
   *           type: string
   *       - in: query
   *         name: entityType
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
   *           default: 50
   *     responses:
   *       200:
   *         description: Activities retrieved successfully
   */
  getAllActivities = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const {
        action,
        userId,
        entityType,
        dateFrom,
        dateTo,
        page = 1,
        limit = 50,
      } = req.query;

      const result = await activityService.getAllActivities(
        {
          action: action as never,
          userId: userId as string,
          entityType: entityType as string,
          dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
          dateTo: dateTo ? new Date(dateTo as string) : undefined,
        },
        {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          sortBy: 'createdAt',
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
   * /api/activity/user/{userId}:
   *   get:
   *     summary: Get activities for a specific user
   *     tags: [Activity]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: userId
   *         required: true
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
   *           default: 50
   *     responses:
   *       200:
   *         description: User activities retrieved successfully
   */
  getUserActivities = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { page = 1, limit = 50 } = req.query;

      const result = await activityService.getActivitiesByUser(req.params.userId, {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    }
  );

  /**
   * @swagger
   * /api/activity/entity/{entityType}/{entityId}:
   *   get:
   *     summary: Get activities for a specific entity
   *     tags: [Activity]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: entityType
   *         required: true
   *         schema:
   *           type: string
   *       - in: path
   *         name: entityId
   *         required: true
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
   *           default: 50
   *     responses:
   *       200:
   *         description: Entity activities retrieved successfully
   */
  getEntityActivities = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { entityType, entityId } = req.params;
      const { page = 1, limit = 50 } = req.query;

      const result = await activityService.getActivitiesByEntity(
        entityType,
        entityId,
        {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          sortBy: 'createdAt',
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

export default new ActivityController();
