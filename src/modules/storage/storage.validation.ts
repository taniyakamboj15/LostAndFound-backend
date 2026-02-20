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
  body('capacity.small')
    .isInt({ min: 0 })
    .withMessage('Small capacity must be at least 0'),
  body('capacity.medium')
    .isInt({ min: 0 })
    .withMessage('Medium capacity must be at least 0'),
  body('capacity.large')
    .isInt({ min: 0 })
    .withMessage('Large capacity must be at least 0'),
  body('city')
    .isString()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('City is required'),
  body('address')
    .optional()
    .isString()
    .trim(),
  body('isPickupPoint')
    .isBoolean()
    .withMessage('isPickupPoint must be a boolean'),
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
  body('capacity.small')
    .optional()
    .isInt({ min: 0 }),
  body('capacity.medium')
    .optional()
    .isInt({ min: 0 }),
  body('capacity.large')
    .optional()
    .isInt({ min: 0 }),
  body('isActive')
    .optional()
    .isBoolean(),
  body('city')
    .optional()
    .isString()
    .trim(),
  body('address')
    .optional()
    .isString()
    .trim(),
  body('isPickupPoint')
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
