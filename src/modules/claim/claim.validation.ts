import { body, param, query } from 'express-validator';
import { ClaimStatus } from '../../common/types';

export const createClaimValidation = [
  body('itemId')
    .isMongoId()
    .withMessage('Valid item ID is required'),
  body('lostReportId')
    .optional()
    .isMongoId()
    .withMessage('Valid lost report ID required'),
  body('description')
    .isString()
    .trim()
    .isLength({ min: 10, max: 1000 })
    .withMessage('Description must be between 10 and 1000 characters'),
];

export const uploadProofValidation = [
  param('id').isMongoId().withMessage('Invalid claim ID'),
  body('type')
    .optional()
    .isString()
    .isIn(['GOVERNMENT_ID', 'INVOICE', 'PHOTO', 'OWNERSHIP_PROOF', 'OTHER']),
];

export const verifyClaimValidation = [
  param('id').isMongoId().withMessage('Invalid claim ID'),
  body('notes')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 500 }),
];

export const rejectClaimValidation = [
  param('id').isMongoId().withMessage('Invalid claim ID'),
  body('reason')
    .isString()
    .trim()
    .isLength({ min: 10, max: 500 })
    .withMessage('Rejection reason is required (10-500 characters)'),
];

export const getAllClaimsValidation = [
  query('status')
    .optional()
    .isIn(Object.values(ClaimStatus)),
  query('page')
    .optional()
    .isInt({ min: 1 }),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }),
];
