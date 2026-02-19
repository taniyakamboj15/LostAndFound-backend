import { Response } from 'express';
import { asyncHandler } from '../../common/helpers/asyncHandler';
import { AuthenticatedRequest } from '../../common/types';
import { ValidationError } from '../../common/errors';
import paymentService from './payment.service';
//complete swaager documetion like other 
/**
 * @swagger
 * tags:
 *   name: Payments
 *   description: Payment management
 */

class PaymentController {
  //swagger documentation
  /**
   * @swagger
   * /api/payments/fee-breakdown/{claimId}:
   *   get:
   *     tags: [Payments]
   *     summary: Get fee breakdown for a claim
   *     parameters:
   *       - in: path
   *         name: claimId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Fee breakdown retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 data:
   *                   type: object
   *                   properties:
   *                     feeBreakdown:
   *                       type: object
   *                       properties:
   *                         claimId:
   *                           type: string
   *                           example: "60d1b2c3d4e5f6g7h8i9j0k1"
   *                         fee:
   *                           type: number
   *                           example: 10.00
   *                         tax:
   *                           type: number
   *                           example: 0.00
   *                         total:
   *                           type: number
   *                           example: 10.00
   *       400:
   *         description: Invalid claim ID
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: false
   *                 message:
   *                   type: string
   *                   example: "Invalid claim ID"
   *                 error:
   *                   type: string
   *                   example: "Invalid claim ID"
   */
  getFeeBreakdown = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { claimId } = req.params;
      const userId = req.user!.id;

      const breakdown = await paymentService.getFeeBreakdown(claimId, userId);

      res.json({ success: true, data: breakdown });
    }
  );

  //swagger documentation
  /**
   * @swagger
   * /api/payments/create-intent:
   *   post:
   *     tags: [Payments]
   *     summary: Create a payment intent
   *     parameters:
   *       - in: body
   *         name: claimId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       201:
   *         description: Payment intent created successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 data:
   *                   type: object
   *                   properties:
   *                     paymentIntentId:
   *                       type: string
   *                       example: "pi_1H2I3J4K5L6M7N8O9P0Q1R2S3T4U5V6W7X8Y9Z0"
   *                     clientSecret:
   *                       type: string
   *                       example: "pi_1H2I3J4K5L6M7N8O9P0Q1R2S3T4U5V6W7X8Y9Z0"
   *       400:
   *         description: Invalid claim ID
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: false
   *                 message:
   *                   type: string
   *                   example: "Invalid claim ID"
   *                 error:
   *                   type: string
   *                   example: "Invalid claim ID"
   */

  createPaymentIntent = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { claimId } = req.body as { claimId: string };
      const userId = req.user!.id;
      const idempotencyKey = (req.headers['idempotency-key'] as string | undefined) || `${claimId}-${userId}`;

      const result = await paymentService.createPaymentIntent(claimId, userId, idempotencyKey);

      res.status(201).json({ success: true, data: result });
    }
  );


  /**
   * @swagger
   * /api/payments/verify:
   *   post:
   *     tags: [Payments]
   *     summary: Verify a payment
   *     parameters:
   *       - in: body
   *         name: paymentIntentId
   *         required: true
   *         schema:
   *           type: string
   *       - in: body
   *         name: claimId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Payment verified successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 message:
   *                   type: string
   *                   example: "Payment verified successfully"
   *                 data:
   *                   type: object
   *                   properties:
   *                     paymentStatus:
   *                       type: string
   *                       example: "PAID"
   *       400:
   *         description: Invalid payment intent ID or claim ID
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: false
   *                 message:
   *                   type: string
   *                   example: "Invalid payment intent ID or claim ID"
   *                 error:
   *                   type: string
   *                   example: "Invalid payment intent ID or claim ID"
   */
  verifyPayment = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { paymentIntentId, claimId } = req.body as { paymentIntentId: string; claimId: string };
      const userId = req.user!.id;

      if (!paymentIntentId || !claimId) {
        throw new ValidationError('paymentIntentId and claimId are required');
      }

      const claim = await paymentService.verifyPayment(paymentIntentId, claimId, userId);

      res.json({
        success: true,
        message: 'Payment verified successfully',
        data: { paymentStatus: claim.paymentStatus },
      });
    }
  );
}

export default new PaymentController();
