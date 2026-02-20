import { Router } from 'express';
import fraudController from './fraud.controller';
import { authenticate } from '../../common/middlewares/auth.middleware';
import { requireRole } from '../../common/middlewares/rbac.middleware';
import { UserRole } from '../../common/types';

const router = Router();

// All fraud routes require Staff/Admin authentication
router.use(authenticate, requireRole(UserRole.STAFF, UserRole.ADMIN));

// GET /api/fraud/high-risk — list all high-risk claims
router.get('/high-risk', fraudController.getHighRiskClaims);

// GET /api/fraud/claim/:claimId — fraud detail for a specific claim
router.get('/claim/:claimId', fraudController.getClaimFraudDetail);

export default router;
