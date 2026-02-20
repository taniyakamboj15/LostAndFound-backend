import { Response } from 'express';
import { asyncHandler } from '../../common/helpers/asyncHandler';
import { AuthenticatedRequest } from '../../common/types';
import { FilterQuery } from 'mongoose';
import { INotification } from './notification.model';
import NotificationModel from './notification.model';
import { NotFoundError } from '../../common/errors';

class NotificationController {
  /**
   * GET /api/notifications
   * Fetch user's recent notifications
   */
  getNotifications = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { page = 1, limit = 20, unreadOnly = 'false' } = req.query;

      const query: FilterQuery<INotification> = { userId: req.user?.id };
      
      if (unreadOnly === 'true') {
        query.isRead = false;
      }

      const total = await NotificationModel.countDocuments(query);
      const notifications = await NotificationModel.find(query)
        .sort({ createdAt: -1 })
        .skip((Number(page) - 1) * Number(limit))
        .limit(Number(limit))
        .lean();

      res.json({
        success: true,
        data: notifications,
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(total / Number(limit)),
        },
      });
    }
  );

  /**
   * PATCH /api/notifications/:id/read
   * Mark a notification as read (stops escalation!)
   */
  markAsRead = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const notification = await NotificationModel.findOneAndUpdate(
        { _id: req.params.id, userId: req.user?.id },
        { $set: { isRead: true } },
        { new: true }
      );

      if (!notification) {
        throw new NotFoundError('Notification not found or unauthorized');
      }

      res.json({
        success: true,
        data: notification,
      });
    }
  );

  /**
   * PATCH /api/notifications/read-all
   * Mark all notifications as read for current user
   */
  markAllAsRead = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      await NotificationModel.updateMany(
        { userId: req.user?.id, isRead: false },
        { $set: { isRead: true } }
      );

      res.json({
        success: true,
        message: 'All notifications marked as read',
      });
    }
  );

  deleteNotification = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      await NotificationModel.deleteOne({ _id: req.params.id, userId: req.user?.id });
      res.json({ success: true, message: 'Notification deleted' });
    }
  );

  clearAll = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      await NotificationModel.deleteMany({ userId: req.user?.id });
      res.json({ success: true, message: 'All notifications cleared' });
    }
  );
}

export default new NotificationController();
