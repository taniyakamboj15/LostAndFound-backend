import { Router } from 'express';
import claimController from './claim.controller';
import { authenticate } from '../../common/middlewares/auth.middleware';
import { requireRole } from '../../common/middlewares/rbac.middleware';
import { validate } from '../../common/middlewares/validation.middleware';
import {
  createClaimValidation,
  uploadProofValidation,
  verifyClaimValidation,
  rejectClaimValidation,
  getAllClaimsValidation,
} from './claim.validation';
import { UserRole } from '../../common/types';
import { strictLimiter } from '../../common/middlewares/rateLimit.middleware';
import { uploadArray } from '../../common/middlewares/multer.middleware';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Create claim (Claimant)
router.post(
  '/',
  requireRole(UserRole.CLAIMANT),
  strictLimiter,
  validate(createClaimValidation),
  claimController.createClaim
);

// Get my claims (Claimant)
router.get(
  '/my-claims',
  requireRole(UserRole.CLAIMANT),
  claimController.getMyClaims
);

// Get all claims (Staff/Admin)
router.get(
  '/',
  requireRole(UserRole.STAFF, UserRole.ADMIN),
  validate(getAllClaimsValidation),
  claimController.getAllClaims
);

// Get claim by ID
router.get('/:id', claimController.getClaimById);

// Upload proof (Claimant - own claims only)
router.post(
  '/:id/proof',
  requireRole(UserRole.CLAIMANT),
  uploadArray('files'),
  validate(uploadProofValidation),
  claimController.uploadProof
);

// Verify claim (Staff/Admin)
router.post(
  '/:id/verify',
  requireRole(UserRole.STAFF, UserRole.ADMIN),
  validate(verifyClaimValidation),
  claimController.verifyClaim
);

// Reject claim (Staff/Admin)
router.post(
  '/:id/reject',
  requireRole(UserRole.STAFF, UserRole.ADMIN),
  validate(rejectClaimValidation),
  claimController.rejectClaim
);

export default router;
