import { body, param } from 'express-validator';

export const sendMessageValidation = [
  body('message')
    .trim()
    .notEmpty()
    .withMessage('Message cannot be empty')
    .isLength({ max: 1000 })
    .withMessage('Message cannot exceed 1000 characters'),

  body('sessionId')
    .optional()
    .isUUID(4)
    .withMessage('Invalid session ID format'),
];

export const sessionParamValidation = [
  param('sessionId')
    .isUUID(4)
    .withMessage('Invalid session ID format'),
];
