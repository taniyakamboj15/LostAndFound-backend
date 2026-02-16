import mongoose, { Schema } from 'mongoose';
import { IPickupModel } from '../../common/types';

export interface IPickup extends IPickupModel {
  isVerified: boolean;
  verifiedAt?: Date;
}

const pickupSchema = new Schema<IPickup>(
  {
    claimId: {
      type: Schema.Types.ObjectId,
      ref: 'Claim',
      required: true,
      unique: true,
      index: true,
    },
    claimantId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    itemId: {
      type: Schema.Types.ObjectId,
      ref: 'Item',
      required: true,
    },
    pickupDate: {
      type: Date,
      required: true,
      index: true,
    },
    startTime: {
      type: String,
      required: true,
    },
    endTime: {
      type: String,
      required: true,
    },
    qrCode: {
      type: String,
      required: true,
      unique: true,
    },
    referenceCode: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    isCompleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    verifiedAt: Date,
    completedAt: Date,
    completedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    notes: String,
  },
  {
    timestamps: true,
  }
);

// Indexes
pickupSchema.index({ pickupDate: 1, isCompleted: 1 });
pickupSchema.index({ claimantId: 1, pickupDate: -1 });

const Pickup = mongoose.model<IPickup>('Pickup', pickupSchema);

export default Pickup;
