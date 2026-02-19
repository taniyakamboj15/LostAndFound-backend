/**
 * Payment Routes
 *
 * All validation is handled by payment.validation.ts (express-validator chains).
 * All authorization is handled by payment.middleware.ts (requireOwnVerifiedClaim).
 * Controller methods contain no validation or auth logic.
 */
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

// ── Global: all payment routes require a logged-in user ──────────────────────
router.use(authenticate);

// ── GET /api/payments/fee-breakdown/:claimId ─────────────────────────────────
// read-only: returns fee estimate, no Stripe call
router.get(
  '/fee-breakdown/:claimId',
  validate(getFeeBreakdownValidation),
  requireOwnVerifiedClaim,
  paymentController.getFeeBreakdown
);

// ── POST /api/payments/create-intent ─────────────────────────────────────────
// creates (or reuses) a Stripe PaymentIntent for a verified claim
router.post(
  '/create-intent',
  validate(createPaymentIntentValidation),
  requireOwnVerifiedClaim,
  paymentController.createPaymentIntent
);

// ── POST /api/payments/verify ─────────────────────────────────────────────────
// confirms payment with Stripe and marks the claim as PAID (idempotent)
router.post(
  '/verify',
  validate(verifyPaymentValidation),
  requireOwnVerifiedClaim,
  paymentController.verifyPayment
);

export default router;
