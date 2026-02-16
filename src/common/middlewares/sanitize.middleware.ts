import { Request, Response, NextFunction } from 'express';
import mongoSanitize from 'express-mongo-sanitize';
import xss from 'xss-clean';

export const sanitizeInput = [
  mongoSanitize({
    replaceWith: '_',
    onSanitize: ({ key }) => {
      console.warn(`Sanitized key: ${key}`);
    },
  }),
  xss(),
];

export const sanitizeMiddleware = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  sanitizeInput.forEach((middleware) => {
    if (typeof middleware === 'function') {
      middleware(req, _res, () => {});
    }
  });
  next();
};
