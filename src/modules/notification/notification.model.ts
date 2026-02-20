import mongoose, { Schema, Document } from 'mongoose';
import { NotificationEvent } from '../../common/types';

export interface INotification extends Document {
  userId: mongoose.Types.ObjectId;
  event: NotificationEvent;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  isRead: boolean;
  channelsSent: string[]; // e.g., ['PUSH', 'EMAIL']
  referenceId?: string; // Optional ID relating to the event (e.g. claimId or itemId)
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    event: {
      type: String,
      enum: Object.values(NotificationEvent),
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    body: {
      type: String,
      required: true,
    },
    data: {
      type: Schema.Types.Mixed,
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    channelsSent: {
      type: [String],
      default: [],
    },
    referenceId: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for quick fetching
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, isRead: 1 });

const NotificationModel = mongoose.model<INotification>('Notification', notificationSchema);

export default NotificationModel;
