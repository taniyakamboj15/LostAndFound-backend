import { Router } from 'express';
import activityController from './activity.controller';
import { authenticate } from '../../common/middlewares/auth.middleware';
import { requireRole } from '../../common/middlewares/rbac.middleware';
import { UserRole } from '../../common/types';

const router = Router();

// All activity routes require authentication
router.use(authenticate);

// Admin and Staff can view all activities
router.get(
  '/',
  requireRole(UserRole.ADMIN, UserRole.STAFF),
  activityController.getAllActivities
);

// Admin and Staff can view user activities
router.get(
  '/user/:userId',
  requireRole(UserRole.ADMIN, UserRole.STAFF),
  activityController.getUserActivities
);

// Admin and Staff can view entity activities
router.get(
  '/entity/:entityType/:entityId',
  requireRole(UserRole.ADMIN, UserRole.STAFF),
  activityController.getEntityActivities
);

export default router;
