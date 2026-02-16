import mongoose, { Schema } from 'mongoose';
import { ItemCategory, ILostReportModel } from '../../common/types';

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
  },
  {
    timestamps: true,
  }
);

// Indexes
lostReportSchema.index({ category: 1, dateLost: -1 });
lostReportSchema.index({ keywords: 1 });
lostReportSchema.index({ locationLost: 'text', description: 'text' });

// Extract keywords
lostReportSchema.pre('save', function (next) {
  if (this.isModified('description')) {
    const words = this.description
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length > 3);
    this.keywords = [...new Set(words)];
  }
  next();
});

const LostReport = mongoose.model<ILostReport>('LostReport', lostReportSchema);

export default LostReport;
