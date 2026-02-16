import { Response } from 'express';
import { asyncHandler } from '../../common/helpers/asyncHandler';
import { AuthenticatedRequest } from '../../common/types';
import matchService from './match.service';

class MatchController {
  getMatchesForReport = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const matches = await matchService.getMatchesForReport(req.params.reportId);

      res.json({
        success: true,
        data: matches,
      });
    }
  );

  getMatchesForItem = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const matches = await matchService.getMatchesForItem(req.params.itemId);

      res.json({
        success: true,
        data: matches,
      });
    }
  );

  generateMatches = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { reportId } = req.body;

      const matches = await matchService.generateMatches(reportId);

      res.json({
        success: true,
        message: `Generated ${matches.length} matches`,
        data: matches,
      });
    }
  );
}

export default new MatchController();
