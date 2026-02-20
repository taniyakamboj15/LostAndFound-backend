import { Response } from 'express';
import { asyncHandler } from '../../common/helpers/asyncHandler';
import { AuthenticatedRequest, ItemCategory } from '../../common/types';
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
    async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
      const metrics = await analyticsService.getDashboardMetrics();

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

  /**
   * @swagger
   * /api/analytics/prediction:
   *   get:
   *     summary: Get time-to-claim prediction
   *     tags: [Analytics]
   *     parameters:
   *       - in: query
   *         name: category
   *         required: true
   *         schema:
   *           type: string
   *       - in: query
   *         name: location
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Prediction retrieved successfully
   */
  getPrediction = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { category, location } = req.query;
      const prediction = await analyticsService.predictTimeToClaim(
        category as ItemCategory, 
        location as string || ''
      );
      res.json({ success: true, data: prediction });
    }
  );

  /**
   * @swagger
   * /api/analytics/storage-optimization:
   *   get:
   *     summary: Get storage optimization insights
   *     tags: [Analytics]
   *     responses:
   *       200:
   *         description: Optimization insights retrieved successfully
   */
  getStorageOptimization = asyncHandler(
    async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
      const insights = await analyticsService.optimizeStorage();
      res.json({ success: true, data: insights });
    }
  );

  /**
   * @swagger
   * /api/analytics/staff-workload:
   *   get:
   *     summary: Get predicted staff workload peaks
   *     tags: [Analytics]
   */
  getStaffWorkload = asyncHandler(
    async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
      const workload = await analyticsService.getStaffWorkloadTrends();
      res.json({ success: true, data: workload });
    }
  );

  /**
   * @swagger
   * /api/analytics/prediction-accuracy:
   *   get:
   *     summary: Get historical prediction accuracy stats
   *     tags: [Analytics]
   */
  getPredictionAccuracy = asyncHandler(
    async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
      const accuracy = await analyticsService.getPredictionAccuracy();
      res.json({ success: true, data: accuracy });
    }
  );
}

export default new AnalyticsController();
