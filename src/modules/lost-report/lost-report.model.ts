import mongoose, { Schema } from 'mongoose';
import { ItemCategory, ILostReportModel, ItemColor, ItemSize } from '../../common/types';

export interface ILostReport extends ILostReportModel {}

const lostReportSchema = new Schema<ILostReport>(
  {
    category: {
      type: String,
      enum: Object.values(ItemCategory),
      required: true,
      index: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    keywords: [
      {
        type: String,
        lowercase: true,
        trim: true,
      },
    ],
    locationLost: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    dateLost: {
      type: Date,
      required: true,
      index: true,
    },
    reportedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    contactEmail: {
      type: String,
      required: true,
      lowercase: true,
    },
    contactPhone: String,
    identifyingFeatures: [String],
    // Structured markers (mirrors item structured fields for matching)
    brand: { type: String, trim: true },
    color: {
      type: String,
      enum: Object.values(ItemColor),
    },
    itemSize: {
      type: String,
      enum: Object.values(ItemSize),
    },
    bagContents: [
      {
        type: String,
        trim: true,
      },
    ],
    starredBy: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    deletedAt: {
      type: Date,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
lostReportSchema.index({ category: 1, dateLost: -1 });
lostReportSchema.index({ keywords: 1 });
lostReportSchema.index({ locationLost: 'text', description: 'text' });
lostReportSchema.index({ reportedBy: 1, createdAt: -1 });

// Extract keywords
lostReportSchema.pre('save', function (this: ILostReport, next) {
  if (this.isModified('description')) {
    const words = this.description
      .toLowerCase()
      .split(/\s+/)
      .filter((word: string) => word.length > 3);
    this.keywords = [...new Set(words)];
  }
  next();
});

// Middleware to exclude deleted reports by default
lostReportSchema.pre(/^find/, function (this: mongoose.Query<ILostReport[], ILostReport>, next) {
  this.where({ deletedAt: null });
  next();
});

const LostReport = mongoose.model<ILostReport>('LostReport', lostReportSchema);

export default LostReport;
