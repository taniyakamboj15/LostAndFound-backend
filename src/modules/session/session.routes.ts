import { Router } from 'express';
import passport from '../../config/passport';
import sessionController from './session.controller';
import { validate } from '../../common/middlewares/validation.middleware';
import { authLimiter } from '../../common/middlewares/rateLimit.middleware';
import {
  registerValidation,
  loginValidation,
} from './session.validation';
import { authenticate } from '../../common/middlewares/auth.middleware';

const router = Router();

// Public routes
router.post(
  '/register',
  authLimiter,
  validate(registerValidation),
  sessionController.register
);

router.post(
  '/login',
  authLimiter,
  validate(loginValidation),
  sessionController.login
);

router.post('/refresh', sessionController.refresh);

// Google OAuth
router.get(
  '/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get(
  '/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/login' }),
  sessionController.googleCallback
);

// Protected routes
router.post('/logout', authenticate, sessionController.logout);

export default router;
