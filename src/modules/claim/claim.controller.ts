import { Response } from 'express';
import { asyncHandler } from '../../common/helpers/asyncHandler';
import { AuthenticatedRequest, MulterRequest } from '../../common/types';
import claimService from './claim.service';

class ClaimController {
  createClaim = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { itemId, description, lostReportId } = req.body;

      const claim = await claimService.createClaim({
        itemId,
        claimantId: req.user!.id,
        description,
        lostReportId,
      });

      res.status(201).json({
        success: true,
        message: 'Claim filed successfully',
        data: claim,
      });
    }
  );

  getMyClaims = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { page = 1, limit = 20 } = req.query;

      const result = await claimService.getMyClaims(req.user!.id, {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
      });

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

  getAllClaims = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { status, page = 1, limit = 20 } = req.query;

      const result = await claimService.getAllClaims(
        { status: status as never },
        {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
        }
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

  getClaimById = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const claim = await claimService.getClaimById(req.params.id);

      res.json({
        success: true,
        data: claim,
      });
    }
  );

  uploadProof = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const files = (req as MulterRequest).files || [];

      const proofDocuments = files.map((file) => ({
        type: req.body.type || 'OTHER',
        filename: file.filename,
        path: file.path.replace(/\\/g, '/'),
      }));

      const claim = await claimService.uploadProof(
        req.params.id,
        req.user!.id,
        proofDocuments
      );

      res.json({
        success: true,
        message: 'Proof uploaded successfully',
        data: claim,
      });
    }
  );

  verifyClaim = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { notes } = req.body;

      const claim = await claimService.verifyClaim(
        req.params.id,
        req.user!.id,
        notes
      );

      res.json({
        success: true,
        message: 'Claim verified successfully',
        data: claim,
      });
    }
  );

  rejectClaim = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { reason } = req.body;

      const claim = await claimService.rejectClaim(
        req.params.id,
        req.user!.id,
        reason
      );

      res.json({
        success: true,
        message: 'Claim rejected',
        data: claim,
      });
    }
  );
}

export default new ClaimController();
