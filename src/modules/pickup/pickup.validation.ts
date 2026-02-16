import { body, param, query } from 'express-validator';

export const bookPickupValidation = [
  body('claimId')
    .isMongoId()
    .withMessage('Valid claim ID is required'),
  body('pickupDate')
    .isISO8601()
    .withMessage('Valid pickup date is required'),
  body('startTime')
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Valid start time required (HH:MM format)'),
  body('endTime')
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Valid end time required (HH:MM format)'),
];

export const completePickupValidation = [
  param('id').isMongoId().withMessage('Invalid pickup ID'),
  body('referenceCode')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 8, max: 8 })
    .withMessage('Valid reference code is required'),
  body('notes')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 500 }),
];

export const verifyReferenceValidation = [
  body('referenceCode')
    .isString()
    .trim()
    .isLength({ min: 8, max: 8 })
    .withMessage('Valid 8-character reference code is required'),
];

export const getAvailableSlotsValidation = [
  query('date')
    .isISO8601()
    .withMessage('Valid date is required'),
];
