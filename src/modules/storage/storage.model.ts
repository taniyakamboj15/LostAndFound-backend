import mongoose, { Schema } from 'mongoose';
import { IStorageModel } from '../../common/types';

export interface IStorage extends IStorageModel {}

const storageSchema = new Schema<IStorage>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    location: {
      type: String,
      required: true,
      trim: true,
    },
    shelfNumber: String,
    binNumber: String,
    capacity: {
      small: { type: Number, required: true, default: 0, min: 0 },
      medium: { type: Number, required: true, default: 0, min: 0 },
      large: { type: Number, required: true, default: 0, min: 0 },
    },
    currentCount: {
      small: { type: Number, default: 0, min: 0 },
      medium: { type: Number, default: 0, min: 0 },
      large: { type: Number, default: 0, min: 0 },
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    isPickupPoint: {
      type: Boolean,
      default: true,
    },
    city: String,
    address: String,
  },
  {
    timestamps: true,
  }
);

// Indexes
storageSchema.index({ isActive: 1, currentCount: 1 });

const Storage = mongoose.model<IStorage>('Storage', storageSchema);

export default Storage;
