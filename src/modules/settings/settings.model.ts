import mongoose, { Schema } from 'mongoose';
import { ISettingsModel } from '../../common/types';

const settingsSchema = new Schema<ISettingsModel>(
  {
    autoMatchThreshold: {
      type: Number,
      default: 85,
    },
    rejectThreshold: {
      type: Number,
      default: 30,
    },
    matchWeights: {
      category: { type: Number, default: 0.10 },
      keyword:  { type: Number, default: 0.10 },
      date:     { type: Number, default: 0.10 },
      location: { type: Number, default: 0.10 },
      feature:  { type: Number, default: 0.45 },
      color:    { type: Number, default: 0.15 },
    },
  },
  {
    timestamps: { createdAt: false, updatedAt: true },
  }
);

// We only want one document in this collection
const Settings = mongoose.model<ISettingsModel>('Settings', settingsSchema);

export default Settings;
