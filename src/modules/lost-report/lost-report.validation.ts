import { body, param, query } from 'express-validator';
import { ItemCategory } from '../../common/types';

export const createLostReportValidation = [
  body('category')
    .isIn(Object.values(ItemCategory))
    .withMessage('Invalid category'),
  body('description')
    .isString()
    .trim()
    .isLength({ min: 10, max: 1000 })
    .withMessage('Description must be between 10 and 1000 characters'),
  body('locationLost')
    .isString()
    .trim()
    .isLength({ min: 3, max: 200 })
    .withMessage('Location is required'),
  body('dateLost')
    .isISO8601()
    .withMessage('Valid date is required'),
  body('contactEmail')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('contactPhone')
    .optional()
    .isMobilePhone(['en-IN', 'en-US', 'en-GB'])
    .withMessage('Valid phone number required'),
  body('identifyingFeatures')
    .isArray({ min: 1 })
    .withMessage('At least one identifying feature is required'),
];

export const updateLostReportValidation = [
  param('id').isMongoId().withMessage('Invalid report ID'),
  body('description')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 10, max: 1000 }),
  body('contactPhone')
    .optional()
    .isMobilePhone(['en-IN', 'en-US', 'en-GB']),
  body('identifyingFeatures')
    .optional()
    .isArray({ min: 1 }),
];

export const searchLostReportsValidation = [
  query('category')
    .optional()
    .isIn(Object.values(ItemCategory)),
  query('location')
    .optional()
    .isString(),
  query('dateLostFrom')
    .optional()
    .isISO8601(),
  query('dateLostTo')
    .optional()
    .isISO8601(),
  query('keyword')
    .optional()
    .isString(),
  query('page')
    .optional()
    .isInt({ min: 1 }),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }),
];
