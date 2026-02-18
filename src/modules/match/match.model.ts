import mongoose, { Schema } from 'mongoose';
import { IMatchModel } from '../../common/types';

export interface IMatch extends IMatchModel {}

const matchSchema = new Schema<IMatch>(
  {
    itemId: {
      type: Schema.Types.ObjectId,
      ref: 'Item',
      required: true,
      index: true,
    },
    lostReportId: {
      type: Schema.Types.ObjectId,
      ref: 'LostReport',
      required: true,
      index: true,
    },
    confidenceScore: {
      type: Number,
      required: true,
      min: 0,
      max: 1,
      index: true,
    },
    categoryScore: {
      type: Number,
      required: true,
      min: 0,
      max: 1,
    },
    keywordScore: {
      type: Number,
      required: true,
      min: 0,
      max: 1,
    },
    dateScore: {
      type: Number,
      required: true,
      min: 0,
      max: 1,
    },
    locationScore: {
      type: Number,
      required: true,
      min: 0,
      max: 1,
    },
    featureScore: {
      type: Number,
      required: true,
      min: 0,
      max: 1,
    },
    notified: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Compound indexes
matchSchema.index({ itemId: 1, confidenceScore: -1 });
matchSchema.index({ lostReportId: 1, confidenceScore: -1 });
matchSchema.index({ confidenceScore: -1, createdAt: -1 });

// Unique constraint: one match per item-report pair
matchSchema.index({ itemId: 1, lostReportId: 1 }, { unique: true });

const Match = mongoose.model<IMatch>('Match', matchSchema);

export default Match;
