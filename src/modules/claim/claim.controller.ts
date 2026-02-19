import { Response } from 'express';
import { asyncHandler } from '../../common/helpers/asyncHandler';
import { AuthenticatedRequest, MulterRequest, UserRole } from '../../common/types';
import claimService from './claim.service';
import { ForbiddenError } from '../../common/errors';

/**
 * @swagger
 * tags:
 *   name: Claims
 *   description: Item claim management and verification
 */
class ClaimController {
  /**
   * @swagger
   * /api/claims:
   *   post:
   *     summary: Create a new claim for an item
   *     tags: [Claims]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - itemId
   *               - description
   *             properties:
   *               itemId:
   *                 type: string
   *               description:
   *                 type: string
   *               lostReportId:
   *                 type: string
   *     responses:
   *       201:
   *         description: Claim created successfully
   */
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

  /**
   * @swagger
   * /api/claims/my:
   *   get:
   *     summary: Get claims filed by the current user
   *     tags: [Claims]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: status
   *         schema:
   *           type: string
   *       - in: query
   *         name: keyword
   *         schema:
   *           type: string
   *       - in: query
   *         name: itemId
   *         schema:
   *           type: string
   *       - in: query
   *         name: date
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
   *         description: User claims retrieved successfully
   */
  getMyClaims = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { status, keyword, itemId, date, page = 1, limit = 20 } = req.query;

      const result = await claimService.getMyClaims(req.user!.id, {
        status: status as never,
        keyword: keyword as string,
        itemId: itemId as string,
        date: date as string,
      }, {
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

  /**
   * @swagger
   * /api/claims:
   *   get:
   *     summary: Get all claims (Staff/Admin only)
   *     tags: [Claims]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: status
   *         schema:
   *           type: string
   *       - in: query
   *         name: keyword
   *         schema:
   *           type: string
   *       - in: query
   *         name: itemId
   *         schema:
   *           type: string
   *       - in: query
   *         name: date
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
   *         description: All claims retrieved successfully
   */
  getAllClaims = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { status, keyword, itemId, date, page = 1, limit = 20 } = req.query;

      const result = await claimService.getAllClaims(
        { 
          status: status as never,
          keyword: keyword as string,
          itemId: itemId as string,
          date: date as string,
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

  /**
   * @swagger
   * /api/claims/{id}:
   *   get:
   *     summary: Get claim details by ID
   *     tags: [Claims]
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
   *         description: Claim details retrieved successfully
   */
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


      const { default: Activity } = await import('../activity/activity.model');
      
      const activities = await Activity.find({
        entityType: 'Claim',
        entityId: claim._id
      })
      .sort({ createdAt: 1 })
      .populate('userId', 'name role');

      const timeline = activities.map(activity => ({
        action: activity.action.replace(/_/g, ' '), // e.g. CLAIM_FILED -> CLAIM FILED
        actor: (activity.userId && typeof activity.userId === 'object' && 'name' in activity.userId) 
          ? (activity.userId as { name: string }).name 
          : 'System',
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

  /**
   * @swagger
   * /api/claims/{id}/proof:
   *   post:
   *     summary: Upload proof documents for a claim
   *     tags: [Claims]
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
   *         multipart/form-data:
   *           schema:
   *             type: object
   *             properties:
   *               type:
   *                 type: string
   *                 enum: [GOVERNMENT_ID, INVOICE, PHOTO, OWNERSHIP_PROOF, OTHER]
   *               documents:
   *                 type: array
   *                 items:
   *                   type: string
   *                   format: binary
   *     responses:
   *       200:
   *         description: Proof documents uploaded successfully
   */
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

  /**
   * @swagger
   * /api/claims/{id}/verify:
   *   post:
   *     summary: Verify a claim (Staff/Admin only)
   *     tags: [Claims]
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
   *               notes:
   *                 type: string
   *     responses:
   *       200:
   *         description: Claim verified successfully
   */
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

  /**
   * @swagger
   * /api/claims/{id}/reject:
   *   post:
   *     summary: Reject a claim (Staff/Admin only)
   *     tags: [Claims]
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
   *             required:
   *               - reason
   *             properties:
   *               reason:
   *                 type: string
   *     responses:
   *       200:
   *         description: Claim rejected
   */
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
