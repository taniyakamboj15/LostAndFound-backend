import { Router } from 'express';
import analyticsController from './analytics.controller';
import { authenticate } from '../../common/middlewares/auth.middleware';
import { requireRole } from '../../common/middlewares/rbac.middleware';
import { UserRole } from '../../common/types';
import { validate } from '../../common/middlewares/validation.middleware';
import { getTrendsValidation } from './analytics.validation';

const router = Router();

// All analytics routes require authentication
router.use(authenticate);

// Dashboard is accessible to all authenticated users (role-aware filtering in service)
router.get('/dashboard', analyticsController.getDashboard);

// More sensitive analytics require Admin role
router.get('/category-breakdown', requireRole(UserRole.ADMIN), analyticsController.getCategoryBreakdown);
router.get('/trends', requireRole(UserRole.ADMIN), validate(getTrendsValidation), analyticsController.getTrends);
router.get('/disposition-stats', requireRole(UserRole.ADMIN), analyticsController.getDispositionStats);
router.get('/payments', requireRole(UserRole.ADMIN), analyticsController.getPaymentAnalytics);

export default router;
