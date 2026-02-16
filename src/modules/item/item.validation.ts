import { body, param, query } from 'express-validator';
import { ItemCategory, ItemStatus } from '../../common/types';

export const createItemValidation = [
  body('category')
    .isIn(Object.values(ItemCategory))
    .withMessage('Invalid category'),
  body('description')
    .isString()
    .trim()
    .isLength({ min: 10, max: 1000 })
    .withMessage('Description must be between 10 and 1000 characters'),
  body('locationFound')
    .isString()
    .trim()
    .isLength({ min: 3, max: 200 })
    .withMessage('Location is required'),
  body('dateFound')
    .isISO8601()
    .withMessage('Valid date is required'),
  body('isHighValue')
    .optional()
    .isBoolean(),
  body('estimatedValue')
    .optional()
    .isFloat({ min: 0 }),
];

export const updateItemValidation = [
  param('id').isMongoId().withMessage('Invalid item ID'),
  body('description')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 10, max: 1000 }),
  body('isHighValue')
    .optional()
    .isBoolean(),
  body('estimatedValue')
    .optional()
    .isFloat({ min: 0 }),
];

export const updateItemStatusValidation = [
  param('id').isMongoId().withMessage('Invalid item ID'),
  body('status')
    .isIn(Object.values(ItemStatus))
    .withMessage('Invalid status'),
];

export const assignStorageValidation = [
  param('id').isMongoId().withMessage('Invalid item ID'),
  body('storageLocationId')
    .isMongoId()
    .withMessage('Valid storage location ID is required'),
];

export const searchItemsValidation = [
  query('category')
    .optional()
    .isIn(Object.values(ItemCategory)),
  query('status')
    .optional()
    .isIn(Object.values(ItemStatus)),
  query('location')
    .optional()
    .isString(),
  query('dateFoundFrom')
    .optional()
    .isISO8601(),
  query('dateFoundTo')
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
