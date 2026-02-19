import { body, param } from 'express-validator';

export const getFeeBreakdownValidation = [
  param('claimId')
    .isMongoId()
    .withMessage('claimId must be a valid MongoDB ObjectId'),
];

export const createPaymentIntentValidation = [
  body('claimId')
    .isMongoId()
    .withMessage('claimId must be a valid MongoDB ObjectId'),
];

export const verifyPaymentValidation = [
  body('paymentIntentId')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('paymentIntentId is required')
    .matches(/^pi_/)
    .withMessage('paymentIntentId must be a valid Stripe Payment Intent ID (begins with pi_)'),
  body('claimId')
    .isMongoId()
    .withMessage('claimId must be a valid MongoDB ObjectId'),
];
