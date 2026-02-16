import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthenticatedRequest, TokenPayload } from '../types';
import { AuthenticationError } from '../errors';
import { asyncHandler } from '../helpers/asyncHandler';
import { JWT } from '../constants';

export const authenticate = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const token = req.cookies?.accessToken;

    if (!token) {
      throw new AuthenticationError('Access token not found');
    }

    try {
      const decoded = jwt.verify(
        token,
        JWT.ACCESS_TOKEN_SECRET
      ) as TokenPayload;

      (req as AuthenticatedRequest).user = {
        id: decoded.id,
        _id: decoded.id, 
        email: decoded.email,
        role: decoded.role,
        isEmailVerified: decoded.isEmailVerified,
      };


      next();
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new AuthenticationError('Access token expired');
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new AuthenticationError('Invalid access token');
      }
      throw error;
    }
  }
);

export const requireEmailVerification = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const authReq = req as AuthenticatedRequest;

    if (!authReq.user?.isEmailVerified) {
      throw new AuthenticationError(
        'Email verification required to perform this action'
      );
    }

    next();
  }
);

export const authorize = (...roles: string[]) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    const authReq = req as AuthenticatedRequest;

    if (!authReq.user) {
      throw new AuthenticationError('User not authenticated');
    }

    if (!roles.includes(authReq.user.role)) {
      throw new AuthenticationError(
        `User role ${authReq.user.role} is not authorized to access this route`
      );
    }

    next();
  };
};
