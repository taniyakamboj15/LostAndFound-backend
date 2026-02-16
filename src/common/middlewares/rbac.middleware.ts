import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest, UserRole } from '../types';
import { AuthorizationError } from '../errors';

export const requireRole = (...allowedRoles: UserRole[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const authReq = req as AuthenticatedRequest;

    if (!authReq.user) {
      throw new AuthorizationError('User not authenticated');
    }

    if (!allowedRoles.includes(authReq.user.role)) {
      throw new AuthorizationError(
        `Access denied. Required roles: ${allowedRoles.join(', ')}`
      );
    }

    next();
  };
};
