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
      max: 100,
      index: true,
    },
    categoryScore: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    keywordScore: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    dateScore: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    locationScore: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    featureScore: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    colorScore: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      max: 100,
    },
    notified: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ['PENDING', 'CONFIRMED', 'REJECTED', 'AUTO_CONFIRMED'],
      default: 'PENDING',
      index: true,
    },
    deletedAt: {
      type: Date,
      index: true,
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

// Middleware to exclude deleted matches by default
matchSchema.pre(/^find/, function (this: mongoose.Query<IMatch[], IMatch>, next) {
  this.where({ deletedAt: null });
  next();
});

const Match = mongoose.model<IMatch>('Match', matchSchema);

export default Match;
