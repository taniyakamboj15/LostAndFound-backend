import { Response } from 'express';
import { asyncHandler } from '../../common/helpers/asyncHandler';
import { AuthenticatedRequest } from '../../common/types';
import analyticsService from './analytics.service';

class AnalyticsController {
  getDashboard = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const metrics = await analyticsService.getDashboardMetrics(req.user!);

      res.json({
        success: true,
        data: metrics,
      });
    }
  );

  getCategoryBreakdown = asyncHandler(
    async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
      const breakdown = await analyticsService.getCategoryBreakdown();

      res.json({
        success: true,
        data: breakdown,
      });
    }
  );

  getTrends = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const days = parseInt(req.query.days as string) || 30;

      const trends = await analyticsService.getItemTrends(days);

      res.json({
        success: true,
        data: trends,
      });
    }
  );

  getDispositionStats = asyncHandler(
    async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
      const stats = await analyticsService.getDispositionStats();

      res.json({
        success: true,
        data: stats,
      });
    }
  );
}

export default new AnalyticsController();
