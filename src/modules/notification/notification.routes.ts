import { Router } from 'express';
import notificationController from './notification.controller';
import { authenticate } from '../../common/middlewares/auth.middleware';

const router = Router();

// All notification routes require authentication
router.use(authenticate);

// Get notifications
router.get('/', notificationController.getNotifications);

// Mark all as read
router.patch('/read-all', notificationController.markAllAsRead);

// Mark specific notification as read
router.patch('/:id/read', notificationController.markAsRead);

// Delete notification
router.delete('/:id', notificationController.deleteNotification);

// Clear all
router.delete('/', notificationController.clearAll);

export default router;
