import mongoose, { Schema } from 'mongoose';
import { ItemStatus, ItemCategory, UploadedFile, IItemModel } from '../../common/types';

export interface IItem extends IItemModel {}

const itemSchema = new Schema<IItem>(
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
    photos: [
      {
        filename: String,
        originalName: String,
        path: String,
        mimetype: String,
        size: Number,
        uploadedAt: Date,
      },
    ],
    locationFound: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    dateFound: {
      type: Date,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(ItemStatus),
      default: ItemStatus.AVAILABLE,
      index: true,
    },
    storageLocation: {
      type: Schema.Types.ObjectId,
      ref: 'Storage',
    },
    retentionPeriodDays: {
      type: Number,
      required: true,
      default: 30,
    },
    retentionExpiryDate: {
      type: Date,
      required: true,
      index: true,
    },
    registeredBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    claimedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    keywords: [
      {
        type: String,
        lowercase: true,
        trim: true,
      },
    ],
    isHighValue: {
      type: Boolean,
      default: false,
    },
    estimatedValue: Number,
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
itemSchema.index({ status: 1, retentionExpiryDate: 1 });
itemSchema.index({ category: 1, status: 1 });
itemSchema.index({ dateFound: -1 });
itemSchema.index({ keywords: 1 });
itemSchema.index({ locationFound: 'text', description: 'text' });

// Pre-save hook to extract keywords
itemSchema.pre('save', function (next) {
  if (this.isModified('description')) {
    const words = this.description
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length > 3);
    this.keywords = [...new Set(words)];
  }
  next();
});

const Item = mongoose.model<IItem>('Item', itemSchema);

export default Item;
