import { Response } from 'express';
import { asyncHandler } from '../../common/helpers/asyncHandler';
import { AuthenticatedRequest } from '../../common/types';
import lostReportService from './lost-report.service';

class LostReportController {
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

  getMyReports = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { page = 1, limit = 20 } = req.query;

      const result = await lostReportService.getMyReports(req.user!.id, {
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

  getReportById = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const report = await lostReportService.getLostReportById(req.params.id);

      res.json({
        success: true,
        data: report,
      });
    }
  );

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
