import { Response } from 'express';
import { asyncHandler } from '../../common/helpers/asyncHandler';
import { AuthenticatedRequest, MulterRequest, UserRole } from '../../common/types';
import claimService from './claim.service';
import { ForbiddenError } from '../../common/errors';

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
      const { status, keyword, page = 1, limit = 20 } = req.query;

      const result = await claimService.getAllClaims(
        { 
          status: status as never,
          keyword: keyword as string 
        },
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

      // Access control
      const isStaffOrAdmin = [UserRole.STAFF, UserRole.ADMIN].includes(
        req.user!.role as UserRole
      );
      
      const claimantDetails = claim.claimantId as unknown as { _id: string } | string;
      const claimantId = typeof claimantDetails === 'object' && '_id' in claimantDetails
        ? claimantDetails._id.toString()
        : claimantDetails.toString();
      const isClaimant = claimantId === req.user!.id;

      if (!isStaffOrAdmin && !isClaimant) {
        throw new ForbiddenError('You do not have permission to view this claim');
      }

      // Fetch timeline from Activity logs
      // We need to dynamically import Activity model to avoid circular dependency if any, 
      // or just import it at top if safe. 
      // Safe to import here as it is not used in model definition.
      const { default: Activity } = await import('../activity/activity.model');
      
      const activities = await Activity.find({
        entityType: 'Claim',
        entityId: claim._id
      })
      .sort({ createdAt: 1 })
      .populate('userId', 'name role');

      const timeline = activities.map(activity => ({
        action: activity.action.replace(/_/g, ' '), // e.g. CLAIM_FILED -> CLAIM FILED
        actor: (activity.userId as any).name || 'System',
        timestamp: activity.createdAt
      }));

      res.json({
        success: true,
        data: {
          ...claim.toObject(),
          timeline
        },
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
