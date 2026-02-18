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

export default router;
