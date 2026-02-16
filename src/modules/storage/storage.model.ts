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
      type: Number,
      required: true,
      min: 1,
    },
    currentCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
storageSchema.index({ isActive: 1, currentCount: 1 });

const Storage = mongoose.model<IStorage>('Storage', storageSchema);

export default Storage;
