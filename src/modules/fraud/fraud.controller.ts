import { Response } from 'express';
import { asyncHandler } from '../../common/helpers/asyncHandler';
import { AuthenticatedRequest } from '../../common/types';
import fraudService from './fraud.service';

class FraudController {
  /** GET /api/fraud/high-risk — list claims above fraud threshold (Admin/Staff) */
  getHighRiskClaims = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { threshold, page = '1', limit = '20' } = req.query;

      const result = await fraudService.getHighRiskClaims(
        threshold ? parseFloat(threshold as string) : undefined,
        parseInt(page as string),
        parseInt(limit as string)
      );

      res.json({
        success: true,
        data: result.data,
        threshold: result.threshold,
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total: result.total,
          totalPages: Math.ceil(result.total / parseInt(limit as string)),
        },
      });
    }
  );

  /** GET /api/fraud/claim/:claimId — fraud detail for a specific claim */
  getClaimFraudDetail = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const detail = await fraudService.getClaimFraudDetail(req.params.claimId);
      if (!detail) {
        res.status(404).json({ success: false, message: 'Claim not found' });
        return;
      }
      res.json({ success: true, data: detail });
    }
  );
}

export default new FraudController();
