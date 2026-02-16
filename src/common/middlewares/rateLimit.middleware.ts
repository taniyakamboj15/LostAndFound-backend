import rateLimit from 'express-rate-limit';
import { RateLimitError } from '../errors';

export const createRateLimiter = (
  windowMs: number = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
  max: number = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100')
) => {
  return rateLimit({
    windowMs,
    max,
    message: 'Too many requests from this IP, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, _res, _next, _options) => {
      throw new RateLimitError();
    },
  });
};

// Specific rate limiters
export const authLimiter = createRateLimiter(15 * 60 * 1000, 50000); // 5 requests per 15 minutes
export const apiLimiter = createRateLimiter(15 * 60 * 1000, 20000); // 100 requests per 15 minutes
export const strictLimiter = createRateLimiter(60 * 60 * 1000, 10000); // 10 requests per hour
