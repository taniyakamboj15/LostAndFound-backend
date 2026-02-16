import { Router } from 'express';
import pickupController from './pickup.controller';
import { authenticate } from '../../common/middlewares/auth.middleware';
import { requireRole } from '../../common/middlewares/rbac.middleware';
import { validate } from '../../common/middlewares/validation.middleware';
import {
  bookPickupValidation,
  completePickupValidation,
  verifyReferenceValidation,
  getAvailableSlotsValidation,
} from './pickup.validation';
import { UserRole } from '../../common/types';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get all pickups (Staff/Admin)
router.get(
  '/',
  requireRole(UserRole.STAFF, UserRole.ADMIN),
  pickupController.getAllPickups
);

// Book pickup (Claimant)
router.post(
  '/',
  requireRole(UserRole.CLAIMANT),
  validate(bookPickupValidation),
  pickupController.bookPickup
);

// Get available slots (Claimant)
router.get(
  '/available-slots',
  requireRole(UserRole.CLAIMANT),
  validate(getAvailableSlotsValidation),
  pickupController.getAvailableSlots
);

// Get my pickups (Claimant)
router.get(
  '/my-pickups',
  requireRole(UserRole.CLAIMANT),
  pickupController.getMyPickups
);

// Get pickup by ID
router.get('/:id', pickupController.getPickupById);

// Complete pickup (Staff/Admin)
router.post(
  '/:id/complete',
  requireRole(UserRole.STAFF, UserRole.ADMIN),
  validate(completePickupValidation),
  pickupController.completePickup
);

// Verify reference code (Staff/Admin)
router.post(
  '/:id/verify',
  requireRole(UserRole.STAFF, UserRole.ADMIN),
  validate(verifyReferenceValidation),
  pickupController.verifyReference
);

export default router;
