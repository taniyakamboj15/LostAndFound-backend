import { body, param, query } from 'express-validator';
import { DispositionType } from '../../common/types';

export const createDispositionValidation = [
  body('itemId')
    .isMongoId()
    .withMessage('Valid item ID is required'),
  body('type')
    .isIn(Object.values(DispositionType))
    .withMessage('Valid disposition type is required'),
  body('recipient')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 2, max: 200 }),
  body('notes')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 500 }),
];

export const getAllDispositionsValidation = [
  query('type')
    .optional()
    .isIn(Object.values(DispositionType)),
  query('dateFrom')
    .optional()
    .isISO8601(),
  query('dateTo')
    .optional()
    .isISO8601(),
  query('page')
    .optional()
    .isInt({ min: 1 }),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }),
];

export const addAuditEntryValidation = [
  param('id').isMongoId().withMessage('Invalid disposition ID'),
  body('action')
    .isString()
    .trim()
    .isLength({ min: 3, max: 100 })
    .withMessage('Action is required'),
  body('details')
    .isString()
    .trim()
    .isLength({ min: 5, max: 500 })
    .withMessage('Details are required'),
];

export const dispositionIdValidation = [
  param('id').isMongoId().withMessage('Invalid disposition ID'),
];
