import { Response } from 'express';
import { asyncHandler } from '../../common/helpers/asyncHandler';
import { AuthenticatedRequest } from '../../common/types';
import analyticsService from './analytics.service';

/**
 * @swagger
 * tags:
 *   name: Analytics
 *   description: Data visualization and metrics
 */
class AnalyticsController {
  /**
   * @swagger
   * /api/analytics/dashboard:
   *   get:
   *     summary: Get high-level metrics for dashboard
   *     tags: [Analytics]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Dashboard metrics retrieved successfully
   */
  getDashboard = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const metrics = await analyticsService.getDashboardMetrics(req.user!);

      res.json({
        success: true,
        data: metrics,
      });
    }
  );

  /**
   * @swagger
   * /api/analytics/categories:
   *   get:
   *     summary: Get breakdown of items by category
   *     tags: [Analytics]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Category breakdown retrieved successfully
   */
  getCategoryBreakdown = asyncHandler(
    async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
      const breakdown = await analyticsService.getCategoryBreakdown();

      res.json({
        success: true,
        data: breakdown,
      });
    }
  );

  /**
   * @swagger
   * /api/analytics/trends:
   *   get:
   *     summary: Get item trends over time
   *     tags: [Analytics]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: days
   *         schema:
   *           type: integer
   *           default: 30
   *     responses:
   *       200:
   *         description: Item trends retrieved successfully
   */
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

  /**
   * @swagger
   * /api/analytics/dispositions:
   *   get:
   *     summary: Get statistics on item dispositions
   *     tags: [Analytics]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Disposition statistics retrieved successfully
   */
  getDispositionStats = asyncHandler(
    async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
      const stats = await analyticsService.getDispositionStats();

      res.json({
        success: true,
        data: stats,
      });
    }
  );
  /**
   * @swagger
   * /api/analytics/payments:
   *   get:
   *     summary: Get payment analytics
   *     tags: [Analytics]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Payment analytics retrieved successfully
   */
  getPaymentAnalytics = asyncHandler(
    async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
      const data = await analyticsService.getPaymentAnalytics();
      res.json({ success: true, data });
    }
  );
}

export default new AnalyticsController();
