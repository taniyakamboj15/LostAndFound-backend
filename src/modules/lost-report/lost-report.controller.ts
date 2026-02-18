import { Response } from 'express';
import { asyncHandler } from '../../common/helpers/asyncHandler';
import { AuthenticatedRequest } from '../../common/types';
import lostReportService from './lost-report.service';

/**
 * @swagger
 * tags:
 *   name: LostReports
 *   description: Missing item reports and matching
 */
class LostReportController {
  /**
   * @swagger
   * /api/lost-reports:
   *   post:
   *     summary: Create a new lost report
   *     tags: [LostReports]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - category
   *               - description
   *               - locationLost
   *               - dateLost
   *             properties:
   *               category:
   *                 type: string
   *               description:
   *                 type: string
   *               locationLost:
   *                 type: string
   *               dateLost:
   *                 type: string
   *                 format: date-time
   *               contactEmail:
   *                 type: string
   *                 format: email
   *               contactPhone:
   *                 type: string
   *               identifyingFeatures:
   *                 type: array
   *                 items:
   *                   type: string
   *     responses:
   *       201:
   *         description: Lost report created successfully
   */
  createReport = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const {
        category,
        description,
        locationLost,
        dateLost,
        contactEmail,
        contactPhone,
        identifyingFeatures,
      } = req.body;

      const report = await lostReportService.createLostReport({
        category,
        description,
        locationLost,
        dateLost: new Date(dateLost),
        reportedBy: req.user!.id,
        contactEmail,
        contactPhone,
        identifyingFeatures,
      });

      res.status(201).json({
        success: true,
        message: 'Lost report submitted successfully',
        data: report,
      });
    }
  );

  /**
   * @swagger
   * /api/lost-reports:
   *   get:
   *     summary: Search lost reports (Staff/Admin see all, Claimant see own)
   *     tags: [LostReports]
   *     security:
   *       - bearerAuth: []
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
   *         name: dateLostFrom
   *         schema:
   *           type: string
   *           format: date
   *       - in: query
   *         name: dateLostTo
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
   *         description: Lost reports retrieved successfully
   */
  getReports = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const {
        category,
        location,
        dateLostFrom,
        dateLostTo,
        keyword,
        page = 1,
        limit = 20,
      } = req.query;

      const query: any = {
        category: category as never,
        location: location as string,
        dateLostFrom: dateLostFrom ? new Date(dateLostFrom as string) : undefined,
        dateLostTo: dateLostTo ? new Date(dateLostTo as string) : undefined,
        keyword: keyword as string,
      };

      if (req.user!.role === 'CLAIMANT') {

         query.reportedBy = req.user!.id;
      }

      const result = await lostReportService.searchLostReports(
        query,
        {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          sortBy: 'dateLost',
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
   * /api/lost-reports/my:
   *   get:
   *     summary: Get lost reports submitted by the current user
   *     tags: [LostReports]
   *     security:
   *       - bearerAuth: []
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
   *         name: dateLostFrom
   *         schema:
   *           type: string
   *           format: date
   *       - in: query
   *         name: dateLostTo
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
   *         description: User lost reports retrieved successfully
   */
  getMyReports = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const {
        category,
        location,
        dateLostFrom,
        dateLostTo,
        keyword,
        page = 1,
        limit = 20
      } = req.query;

      const filters = {
        category: category as never,
        location: location as string,
        dateLostFrom: dateLostFrom ? new Date(dateLostFrom as string) : undefined,
        dateLostTo: dateLostTo ? new Date(dateLostTo as string) : undefined,
        keyword: keyword as string,
      };

      const result = await lostReportService.getMyReports(req.user!.id, filters, {
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
   * /api/lost-reports/{id}:
   *   get:
   *     summary: Get lost report details by ID
   *     tags: [LostReports]
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
   *         description: Lost report details retrieved successfully
   */
  getReportById = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const report = await lostReportService.getLostReportById(req.params.id);

      res.json({
        success: true,
        data: report,
      });
    }
  );

  /**
   * @swagger
   * /api/lost-reports/{id}:
   *   patch:
   *     summary: Update a lost report
   *     tags: [LostReports]
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
   *               description:
   *                 type: string
   *               contactPhone:
   *                 type: string
   *               identifyingFeatures:
   *                 type: array
   *                 items:
   *                   type: string
   *     responses:
   *       200:
   *         description: Lost report updated successfully
   */
  updateReport = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { description, contactPhone, identifyingFeatures } = req.body;

      const report = await lostReportService.updateLostReport(
        req.params.id,
        req.user!.id,
        { description, contactPhone, identifyingFeatures }
      );

      res.json({
        success: true,
        message: 'Report updated successfully',
        data: report,
      });
    }
  );

  /**
   * @swagger
   * /api/lost-reports/{id}:
   *   delete:
   *     summary: Delete a lost report
   *     tags: [LostReports]
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
   *         description: Lost report deleted successfully
   */
  deleteReport = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      await lostReportService.deleteLostReport(req.params.id, req.user!.id);

      res.json({
        success: true,
        message: 'Report deleted successfully',
      });
    }
  );
}

export default new LostReportController();
