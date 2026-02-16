import { body, param } from 'express-validator';

export const generateMatchesValidation = [
  body('reportId')
    .isMongoId()
    .withMessage('Valid report ID is required'),
];

export const getMatchesValidation = [
  param('reportId')
    .optional()
    .isMongoId()
    .withMessage('Invalid report ID'),
  param('itemId')
    .optional()
    .isMongoId()
    .withMessage('Invalid item ID'),
];
