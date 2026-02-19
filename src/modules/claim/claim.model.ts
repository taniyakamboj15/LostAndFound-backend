import mongoose, { Schema } from 'mongoose';
import { ClaimStatus, IClaimModel, PaymentStatus } from '../../common/types';

export interface IClaim extends IClaimModel {}

const claimSchema = new Schema<IClaim>(
  {
    itemId: {
      type: Schema.Types.ObjectId,
      ref: 'Item',
      required: true,
      index: true,
    },
    claimantId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    lostReportId: {
      type: Schema.Types.ObjectId,
      ref: 'LostReport',
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: Object.values(ClaimStatus),
      default: ClaimStatus.FILED,
      index: true,
    },
    proofDocuments: [
      {
        type: {
          type: String,
          enum: ['GOVERNMENT_ID', 'INVOICE', 'PHOTO', 'OWNERSHIP_PROOF', 'OTHER'],
        },
        filename: String,
        path: String,
        uploadedAt: Date,
      },
    ],
    verificationNotes: String,
    verifiedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    verifiedAt: Date,
    rejectionReason: String,
    paymentStatus: {
      type: String,
      enum: Object.values(PaymentStatus),
      default: PaymentStatus.PENDING,
      index: true,
    },
    feeDetails: {
      handlingFee: { type: Number },
      storageFee: { type: Number },
      daysStored: { type: Number },
      totalAmount: { type: Number },
      paidAt: { type: Date },
      transactionId: { type: String },
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
claimSchema.index({ itemId: 1, status: 1 });
claimSchema.index({ claimantId: 1, createdAt: -1 });
claimSchema.index({ status: 1, createdAt: -1 });

const Claim = mongoose.model<IClaim>('Claim', claimSchema);

export default Claim;
