import { Router } from 'express';
import lostReportController from './lost-report.controller';
import { authenticate } from '../../common/middlewares/auth.middleware';
import { requireRole } from '../../common/middlewares/rbac.middleware';
import { validate } from '../../common/middlewares/validation.middleware';
import {
  createLostReportValidation,
  updateLostReportValidation,
  searchLostReportsValidation,
} from './lost-report.validation';
import { UserRole } from '../../common/types';
import { strictLimiter } from '../../common/middlewares/rateLimit.middleware';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Create lost report (Claimant)
router.post(
  '/',
  requireRole(UserRole.CLAIMANT),
  strictLimiter,
  validate(createLostReportValidation),
  lostReportController.createReport
);

// Get my reports (Claimant)
router.get(
  '/my-reports',
  requireRole(UserRole.CLAIMANT),
  lostReportController.getMyReports
);

// Search reports (Staff/Admin)
router.get(
  '/',
  requireRole(UserRole.STAFF, UserRole.ADMIN),
  validate(searchLostReportsValidation),
  lostReportController.getReports
);

// Get report by ID
router.get('/:id', lostReportController.getReportById);

// Update report (Claimant - own reports only)
router.patch(
  '/:id',
  requireRole(UserRole.CLAIMANT),
  validate(updateLostReportValidation),
  lostReportController.updateReport
);

// Delete report (Claimant - own reports only)
router.delete(
  '/:id',
  requireRole(UserRole.CLAIMANT),
  lostReportController.deleteReport
);

export default router;
