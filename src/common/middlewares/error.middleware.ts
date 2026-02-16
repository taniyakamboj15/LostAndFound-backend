import { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors';
import logger from '../utils/logger';

export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  if (err instanceof AppError) {
    logger.error('Operational Error:', {
      message: err.message,
      statusCode: err.statusCode,
      code: err.code,
      stack: err.stack,
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
    });

    res.status(err.statusCode).json({
      success: false,
      error: {
        message: err.message,
        code: err.code,
      },
    });
    return;
  }

  // Unexpected errors
  logger.error('Unexpected Error:', {
    message: err.message,
    stack: err.stack,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    body: process.env.NODE_ENV !== 'production' ? req.body : undefined,
  });

  res.status(500).json({
    success: false,
    error: {
      message:
        process.env.NODE_ENV === 'production'
          ? 'Internal server error'
          : err.message,
      code: 'INTERNAL_ERROR',
    },
  });
};

export const notFoundHandler = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  const error = new AppError(`Route not found: ${req.originalUrl}`, 404);
  next(error);
};
