import mongoose, { Schema, Document } from 'mongoose';
import { TransferStatus } from '../../common/types';

export interface ITransfer extends Document {
  claimId: mongoose.Types.ObjectId;
  itemId: mongoose.Types.ObjectId;
  fromStorageId: mongoose.Types.ObjectId;
  toStorageId: mongoose.Types.ObjectId;
  status: TransferStatus;
  estimatedArrival?: Date;
  shippedAt?: Date;
  receivedAt?: Date;
  carrierInfo?: string;
  notes?: string;
  updatedBy?: mongoose.Types.ObjectId;
}

const transferSchema = new Schema<ITransfer>(
  {
    claimId: {
      type: Schema.Types.ObjectId,
      ref: 'Claim',
      required: true,
      index: true,
    },
    itemId: {
      type: Schema.Types.ObjectId,
      ref: 'Item',
      required: true,
    },
    fromStorageId: {
      type: Schema.Types.ObjectId,
      ref: 'Storage',
      required: true,
    },
    toStorageId: {
      type: Schema.Types.ObjectId,
      ref: 'Storage',
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(TransferStatus),
      default: TransferStatus.PENDING,
      index: true,
    },
    estimatedArrival: Date,
    shippedAt: Date,
    receivedAt: Date,
    carrierInfo: String,
    notes: String,
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<ITransfer>('Transfer', transferSchema);
