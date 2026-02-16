import mongoose, { Schema } from 'mongoose';
import { ActivityAction, IActivityModel } from '../../common/types';

export interface IActivity extends IActivityModel {}

const activitySchema = new Schema<IActivity>(
  {
    action: {
      type: String,
      enum: Object.values(ActivityAction),
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    entityType: {
      type: String,
      required: true,
      index: true,
    },
    entityId: {
      type: String,
      required: true,
      index: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    ipAddress: String,
    userAgent: String,
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Compound indexes
activitySchema.index({ userId: 1, createdAt: -1 });
activitySchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
activitySchema.index({ action: 1, createdAt: -1 });

const Activity = mongoose.model<IActivity>('Activity', activitySchema);

export default Activity;
