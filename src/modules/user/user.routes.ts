import { Router } from 'express';
import userController from './user.controller';
import { validate } from '../../common/middlewares/validation.middleware';
import { updateProfileValidation } from './user.validation';
import { authenticate, authorize } from '../../common/middlewares/auth.middleware';
import { UserRole } from '../../common/types';
import {
  verifyEmailValidation,
  resendVerificationValidation,
} from '../session/session.validation';

const router = Router();

// Public routes
router.post(
  '/verify-email',
  validate(verifyEmailValidation),
  userController.verifyEmail
);

router.post(
  '/resend-verification',
  validate(resendVerificationValidation),
  userController.resendVerification
);

// Protected routes
router.get('/profile', authenticate, userController.getProfile);

router.patch(
  '/profile',
  authenticate,
  validate(updateProfileValidation),
  userController.updateProfile
);

// Admin routes
router.post(
  '/',
  authenticate,
  authorize(UserRole.ADMIN),
  userController.createUser
);

router.get(
  '/',
  authenticate,
  authorize(UserRole.ADMIN),
  userController.getUsers
);

export default router;
