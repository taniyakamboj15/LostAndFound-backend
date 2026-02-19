import { body, param, query } from 'express-validator';

export const createStorageValidation = [
  body('name')
    .isString()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name is required (2-100 characters)'),
  body('location')
    .isString()
    .trim()
    .isLength({ min: 3, max: 200 })
    .withMessage('Location is required'),
  body('shelfNumber')
    .optional()
    .isString(),
  body('binNumber')
    .optional()
    .isString(),
  body('capacity')
    .isInt({ min: 1 })
    .withMessage('Capacity must be at least 1'),
];

export const updateStorageValidation = [
  param('id').isMongoId().withMessage('Invalid storage ID'),
  body('name')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 2, max: 100 }),
  body('location')
    .optional()
    .isString()
    .trim(),
  body('shelfNumber')
    .optional()
    .isString(),
  body('binNumber')
    .optional()
    .isString(),
  body('capacity')
    .optional()
    .isInt({ min: 1 }),
  body('isActive')
    .optional()
    .isBoolean(),
];

export const getAllStorageValidation = [
  query('isActive')
    .optional()
    .isBoolean(),
  query('page')
    .optional()
    .isInt({ min: 1 }),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }),
];

export const storageIdValidation = [
  param('id').isMongoId().withMessage('Invalid storage ID'),
];
