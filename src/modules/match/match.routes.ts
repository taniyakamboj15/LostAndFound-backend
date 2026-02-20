import { Router } from 'express';
import matchController from './match.controller';
import { authenticate } from '../../common/middlewares/auth.middleware';
import { requireRole } from '../../common/middlewares/rbac.middleware';
import { validate } from '../../common/middlewares/validation.middleware';
import { generateMatchesValidation, getMatchesValidation } from './match.validation';
import { UserRole } from '../../common/types';
import { verifyReportOwnership } from '../lost-report/lost-report.middleware';

const router = Router();

// All routes require authentication
router.use(authenticate);



// Get matches for a report (Claimant - own reports, Staff/Admin - all)
router.get(
  '/report/:reportId',
  validate(getMatchesValidation),
  verifyReportOwnership,
  matchController.getMatchesForReport
);

// Get matches for an item (Staff/Admin)
router.get(
  '/item/:itemId',
  requireRole(UserRole.STAFF, UserRole.ADMIN),
  validate(getMatchesValidation),
  matchController.getMatchesForItem
);

// Generate matches manually (Staff/Admin)
router.post(
  '/generate',
  requireRole(UserRole.STAFF, UserRole.ADMIN),
  validate(generateMatchesValidation),
  matchController.generateMatches
);

// Get all matches (Staff/Admin) - for dashboard
router.get(
  '/',
  requireRole(UserRole.STAFF, UserRole.ADMIN),
  matchController.getAllMatches
);

// Get match threshold config (Staff/Admin)
router.get(
  '/config',
  requireRole(UserRole.STAFF, UserRole.ADMIN),
  matchController.getConfig
);

// Update match threshold config (Admin/Staff)
router.put(
  '/config',
  requireRole(UserRole.ADMIN, UserRole.STAFF),
  matchController.updateConfig
);

// Update match status (Staff/Admin)
router.patch(
  '/:id/status',
  requireRole(UserRole.STAFF, UserRole.ADMIN),
  matchController.updateMatchStatus
);

// Re-scan all pending matches (Admin/Staff)
router.post(
  '/rescan',
  requireRole(UserRole.ADMIN, UserRole.STAFF),
  matchController.rescan
);

export default router;
