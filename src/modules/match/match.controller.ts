import { Response } from 'express';
import { asyncHandler } from '../../common/helpers/asyncHandler';
import { AuthenticatedRequest } from '../../common/types';
import matchService from './match.service';

/**
 * @swagger
 * tags:
 *   name: Matches
 *   description: Automatic matching between items and lost reports
 */
class MatchController {
  /**
   * @swagger
   * /api/matches/report/{reportId}:
   *   get:
   *     summary: Get potential item matches for a lost report
   *     tags: [Matches]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: reportId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Matches retrieved successfully
   */
  getMatchesForReport = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const matches = await matchService.getMatchesForReport(req.params.reportId);

      res.json({
        success: true,
        data: matches,
      });
    }
  );

  /**
   * @swagger
   * /api/matches/item/{itemId}:
   *   get:
   *     summary: Get potential lost report matches for an item
   *     tags: [Matches]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: itemId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Matches retrieved successfully
   */
  getMatchesForItem = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const matches = await matchService.getMatchesForItem(req.params.itemId);

      res.json({
        success: true,
        data: matches,
      });
    }
  );

  /**
   * @swagger
   * /api/matches/generate:
   *   post:
   *     summary: Manually trigger match generation for a report
   *     tags: [Matches]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - reportId
   *             properties:
   *               reportId:
   *                 type: string
   *     responses:
   *       200:
   *         description: Matches generated successfully
   */
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
