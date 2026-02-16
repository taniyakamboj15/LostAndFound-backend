import { Response } from 'express';
import { asyncHandler } from '../../common/helpers/asyncHandler';
import { AuthenticatedRequest } from '../../common/types';
import activityService from './activity.service';

class ActivityController {
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
