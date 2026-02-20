import { Response } from 'express';
import { asyncHandler } from '../../common/helpers/asyncHandler';
import { AuthenticatedRequest } from '../../common/types';
import matchService from './match.service';

class MatchController {
  getMatchesForReport = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const matches = await matchService.getMatchesForReport(req.params.reportId);
      res.json({ success: true, data: matches });
    }
  );

  getMatchesForItem = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const matches = await matchService.getMatchesForItem(req.params.itemId);
      res.json({ success: true, data: matches });
    }
  );

  generateMatches = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { reportId, itemId } = req.body;
      const matches = await matchService.generateMatches({ lostReportId: reportId, itemId });
      res.json({ success: true, message: `Generated ${matches.length} matches`, data: matches });
    }
  );

  getAllMatches = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { status, minConfidence, fromDate, toDate, search, page = 1, limit = 20 } = req.query;

      const result = await matchService.getAllMatches(
        {
          status: status as string,
          minConfidence: minConfidence ? parseFloat(minConfidence as string) : undefined,
          fromDate: fromDate as string,
          toDate: toDate as string,
          search: search as string,
        },
        { page: parseInt(page as string), limit: parseInt(limit as string) }
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

  updateMatchStatus = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { status } = req.body;
      const match = await matchService.updateMatchStatus(req.params.id, status);
      res.json({ success: true, data: match });
    }
  );

  rescan = asyncHandler(
    async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
      await matchService.reScanAll();
      res.json({ success: true, message: 'Re-scan complete. All pending matches updated.' });
    }
  );

  /** GET /api/matches/config — get current threshold/weight configuration */
  getConfig = asyncHandler(
    async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
      res.json({ success: true, data: matchService.getConfig() });
    }
  );

  /** PUT /api/matches/config — update thresholds & weights (Admin/Staff) */
  updateConfig = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { autoMatchThreshold, rejectThreshold, weights } = req.body;
      const config = matchService.updateConfig({ autoMatchThreshold, rejectThreshold, weights });
      res.json({ success: true, message: 'Match config updated', data: config });
    }
  );
}

export default new MatchController();
