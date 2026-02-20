import { Router } from 'express';
import transferController from './transfer.controller';
import { authenticate } from '../../common/middlewares/auth.middleware';
import { requireRole } from '../../common/middlewares/rbac.middleware';
import { UserRole } from '../../common/types';

const router = Router();

// Staff/Admin only routes for management
router.use(authenticate);

router.get(
  '/',
  requireRole(UserRole.STAFF, UserRole.ADMIN),
  transferController.getAll
);

router.get(
  '/claim/:claimId',
  transferController.getByClaim
);

router.get(
  '/:id',
  transferController.getById
);

router.patch(
  '/:id/status',
  requireRole(UserRole.STAFF, UserRole.ADMIN),
  transferController.updateStatus
);

export default router;
