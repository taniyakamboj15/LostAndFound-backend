
import { Router } from 'express';
import { authenticate } from '../../common/middlewares/auth.middleware';
import { validate } from '../../common/middlewares/validation.middleware';
import { requireOwnVerifiedClaim } from './payment.middleware';
import {
  getFeeBreakdownValidation,
  createPaymentIntentValidation,
  verifyPaymentValidation,
} from './payment.validation';
import paymentController from './payment.controller';

const router = Router();

// Global: all payment routes require a logged-in user 
router.use(authenticate);

// GET /api/payments/fee-breakdown/:claimId 
router.get(
  '/fee-breakdown/:claimId',
  validate(getFeeBreakdownValidation),
  requireOwnVerifiedClaim,
  paymentController.getFeeBreakdown
);

// POST /api/payments/create-intent 
router.post(
  '/create-intent',
  validate(createPaymentIntentValidation),
  requireOwnVerifiedClaim,
  paymentController.createPaymentIntent
);

// POST /api/payments/verify 
router.post(
  '/verify',
  validate(verifyPaymentValidation),
  requireOwnVerifiedClaim,
  paymentController.verifyPayment
);

export default router;
