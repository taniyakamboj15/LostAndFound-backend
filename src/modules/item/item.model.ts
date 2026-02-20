import mongoose, { Schema } from 'mongoose';
import { ItemStatus, ItemCategory, IItemModel, ItemColor, ItemSize } from '../../common/types';

export interface IItem extends IItemModel {
  finderContact?: {
    email?: string;
    phone?: string;
  };
}

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
    finderContact: {
      email: String,
      phone: String,
    },
    keywords: [
      {
        type: String,
        lowercase: true,
        trim: true,
      },
    ],
    identifyingFeatures: [
      {
        type: String,
        trim: true,
      },
    ],
    isHighValue: {
      type: Boolean,
      default: false,
    },
    estimatedValue: Number,
    // Structured identifying markers
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
    // Secret identifiers for challenge-response verification (not returned in public queries)
    secretIdentifiers: {
      type: [String],
      select: false,
    },
    // Predictive analytics data stored at intake
    prediction: {
      likelihood: { type: Number, min: 0, max: 1, default: 0.5 },
      estimatedDaysToClaim: { type: Number, default: 7 },
      confidence: { type: Number, min: 0, max: 1, default: 0.5 },
      actualClaimDays: { type: Number }, // Populated when claimed/returned
      isAccuracyTracked: { type: Boolean, default: false },
    },
    deletedAt: {
      type: Date,
      index: true,
    },
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
itemSchema.index({ locationFound: 'text', description: 'text', identifyingFeatures: 'text' });
itemSchema.index({ registeredBy: 1, createdAt: -1 });

// Pre-save hook to extract keywords
itemSchema.pre('save', function (this: IItem, next) {
  if (this.isModified('description')) {
    const words = this.description
      .toLowerCase()
      .split(/\s+/)
      .filter((word: string) => word.length > 3);
    this.keywords = [...new Set(words)];
  }
  next();
});

// Middleware to exclude deleted items by default
itemSchema.pre(/^find/, function (this: mongoose.Query<IItem[], IItem>, next) {
  this.where({ deletedAt: null });
  next();
});

const Item = mongoose.model<IItem>('Item', itemSchema);

export default Item;
