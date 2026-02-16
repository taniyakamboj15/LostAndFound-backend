import mongoose, { Schema } from 'mongoose';
import { DispositionType, IDispositionModel } from '../../common/types';

export interface IDisposition extends IDispositionModel {}

const dispositionSchema = new Schema<IDisposition>(
  {
    itemId: {
      type: Schema.Types.ObjectId,
      ref: 'Item',
      required: true,
      unique: true,
      index: true,
    },
    type: {
      type: String,
      enum: Object.values(DispositionType),
      required: true,
      index: true,
    },
    processedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    processedAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    recipient: String,
    notes: String,
    auditTrail: [
      {
        action: String,
        timestamp: Date,
        userId: {
          type: Schema.Types.ObjectId,
          ref: 'User',
        },
        details: String,
      },
    ],
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Indexes
dispositionSchema.index({ type: 1, processedAt: -1 });

const Disposition = mongoose.model<IDisposition>('Disposition', dispositionSchema);

export default Disposition;
