import { Response, NextFunction } from 'express';
import { AuthenticatedRequest, UserRole } from '../../common/types';
import { ForbiddenError, NotFoundError } from '../../common/errors';
import { asyncHandler } from '../../common/helpers/asyncHandler';
import LostReport from './lost-report.model';

export const verifyReportOwnership = asyncHandler(
  async (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    const reportId = req.params.reportId || req.body.reportId;
    
    if (!reportId) {
        return next();
    }

    // Skip check for Staff/Admin
    if (req.user!.role === UserRole.STAFF || req.user!.role === UserRole.ADMIN) {
      return next();
    }

    const report = await LostReport.findById(reportId);

    if (!report) {
      throw new NotFoundError('Lost report not found');
    }

    if (report.reportedBy.toString() !== req.user!.id) {
      throw new ForbiddenError('You are not authorized to access this report');
    }

    next();
  }
);
