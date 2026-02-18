import { Router } from 'express';
import sessionRoutes from '../modules/session/session.routes';
import userRoutes from '../modules/user/user.routes';
import itemRoutes from '../modules/item/item.routes';
import lostReportRoutes from '../modules/lost-report/lost-report.routes';
import claimRoutes from '../modules/claim/claim.routes';
import matchRoutes from '../modules/match/match.routes';
import storageRoutes from '../modules/storage/storage.routes';
import pickupRoutes from '../modules/pickup/pickup.routes';
import dispositionRoutes from '../modules/disposition/disposition.routes';
import analyticsRoutes from '../modules/analytics/analytics.routes';
import activityRoutes from '../modules/activity/activity.routes';
import chatRoutes from '../modules/chat/chat.routes';
import { apiLimiter } from '../common/middlewares/rateLimit.middleware';
import { sanitizeMiddleware } from '../common/middlewares/sanitize.middleware';
const router = Router();

// Apply global middleware
router.use(sanitizeMiddleware);
router.use(apiLimiter);

// Health check
router.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Public routes (no authentication required)
// Public routes (handled in respective modules)

// Mount authenticated routes
router.use('/auth', sessionRoutes);
router.use('/users', userRoutes);
router.use('/items', itemRoutes);
router.use('/lost-reports', lostReportRoutes);
router.use('/claims', claimRoutes);
router.use('/matches', matchRoutes);
router.use('/storage', storageRoutes);
router.use('/pickups', pickupRoutes);
router.use('/dispositions', dispositionRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/activities', activityRoutes);
router.use('/chat', chatRoutes);

export default router;
