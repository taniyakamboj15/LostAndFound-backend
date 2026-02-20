
import { Request, Response } from 'express';
import { asyncHandler } from '../../common/helpers/asyncHandler';
import claimService from './claim.service';

/**
 * @swagger
 * tags:
 *   name: Claims
 *   description: Item claim management
 */
class AnonymousClaimController {
  /**
    * @swagger
    * /api/claims/anonymous:
    *   post:
    *     summary: Create an anonymous claim for an item
    *     tags: [Claims]
    *     requestBody:
    *       required: true
    *       content:
    *         application/json:
    *           schema:
    *             type: object
    *             required:
    *               - itemId
    *               - description
    *               - email
    *             properties:
    *               itemId:
    *                 type: string
    *               description:
    *                 type: string
    *               email:
    *                 type: string
    *                 format: email
    *     responses:
    *       201:
    *         description: Claim filed successfully
    */
    createAnonymousClaim = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { itemId, description, email, preferredPickupLocation } = req.body;
      const files = (req.files as Express.Multer.File[]) || [];
      
      const proofDocuments = files.map((file) => ({
        type: 'OWNERSHIP_PROOF',
        filename: file.filename,
        path: file.path.replace(/\\/g, '/'),
      }));

      // Basic validation handled by service or here?
      // Service handles business logic.

      await claimService.createAnonymousClaim({
        itemId,
        description,
        email,
        preferredPickupLocation,
        proofDocuments,
      });

      // Token is sent via email — we intentionally don't expose it in the response
      res.status(201).json({
        success: true,
        message: 'Claim filed successfully. Please check your email for further instructions.',
      });
    }
  );
}

export default new AnonymousClaimController();
