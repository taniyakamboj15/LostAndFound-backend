import mongoose from 'mongoose';
import Stripe from 'stripe';
import { IItemModel, IClaimModel, PaymentStatus, FeeBreakdown, NotificationEvent, ClaimStatus, TransferStatus, ActivityAction, ItemStatus } from '../../common/types';
import Claim from '../claim/claim.model';
import { IStorage } from '../storage/storage.model';
import notificationService from '../notification/notification.service';
import activityService from '../activity/activity.service';
import { NotFoundError, AuthorizationError, ValidationError, InternalServerError } from '../../common/errors';
import transferService from '../transfer/transfer.service';
import { FEES } from '../../common/constants';

class PaymentService {
  private stripe: Stripe;
  constructor() {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2026-01-28.clover',
    });
  }

  public calculateFee(item: IItemModel): FeeBreakdown {
    const now = new Date();
    const foundDate = new Date(item.dateFound);
    const diffMs = Math.abs(now.getTime() - foundDate.getTime());
    const daysStored = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    const storageFee = daysStored * FEES.STORAGE_FEE_PER_DAY;
    const totalAmount = FEES.HANDLING_FEE + storageFee;
    return { handlingFee: FEES.HANDLING_FEE, storageFee, daysStored, totalAmount };
  }

  private validate(rules: { check: () => boolean; error: () => Error }[]): void {
      const failed = rules.find(r => r.check());
      const strategy = {
          true: () => { throw failed!.error(); },
          false: () => {}
      };
      // Explicit cast to keyof to satisfy TS
      const key = String(Boolean(failed)) as keyof typeof strategy;
      strategy[key]();
  }

  async getFeeBreakdown(claimId: string, userId: string): Promise<FeeBreakdown> {
    const claim = await Claim.findById(claimId).populate('itemId');

    this.validate([
        { check: () => !claim, error: () => new NotFoundError('Claim not found') },
        { check: () => claim?.claimantId?.toString() !== userId, error: () => new AuthorizationError() },
        { check: () => claim?.status !== 'VERIFIED', error: () => new ValidationError('Claim must be verified') },
        { check: () => !claim?.itemId, error: () => new InternalServerError('Item missing from claim') }
    ]);

    return this.calculateFee(claim!.itemId as IItemModel);
  }

  async createPaymentIntent(
    claimId: string,
    userId: string,
    idempotencyKey: string,
  ): Promise<{ clientSecret: string; breakdown: FeeBreakdown; paymentIntentId: string }> {
    const claim = await Claim.findById(claimId).populate('itemId');

    this.validate([
        { check: () => !claim, error: () => new NotFoundError('Claim not found') },
        { check: () => claim?.claimantId?.toString() !== userId, error: () => new AuthorizationError() },
        { check: () => claim?.status !== 'VERIFIED', error: () => new ValidationError('Claim must be verified before payment') },
        { check: () => claim?.paymentStatus === PaymentStatus.PAID, error: () => new ValidationError('Payment already completed') },
        { check: () => !claim?.itemId, error: () => new InternalServerError('Item details not available') }
    ]);

    const item = claim!.itemId as IItemModel;
    const feeBreakdown = this.calculateFee(item);

    const existingIntentId = claim!.feeDetails?.transactionId;
    
    // Strategy for handling existing intent
    const handleExisting = async () => {
         try {
            const existing = await this.stripe.paymentIntents.retrieve(existingIntentId!);
            const reusable = existing.status !== 'succeeded' && existing.status !== 'canceled';
            
            const useExisting = () => {
                 const clientSecret = existing.client_secret;
                 // Validation within strategy
                 this.validate([{ check: () => !clientSecret, error: () => new InternalServerError('Stored payment intent has no client secret') }]);
                 return { clientSecret: clientSecret!, breakdown: feeBreakdown, paymentIntentId: existing.id };
            };

            const fallback = async () => this.createNewIntent(claim!, item, userId, feeBreakdown, idempotencyKey);
            
            const key = String(reusable) as "true" | "false";
            const subStrategy = { true: useExisting, false: fallback };
            return subStrategy[key]();

         } catch {
             return this.createNewIntent(claim!, item, userId, feeBreakdown, idempotencyKey);
         }
    }

    const strategies = {
        true: handleExisting,
        false: async () => this.createNewIntent(claim!, item, userId, feeBreakdown, idempotencyKey)
    };
    
    const key = String(Boolean(existingIntentId)) as keyof typeof strategies;
    return strategies[key]();
  }

  private async createNewIntent(claim: IClaimModel, item: IItemModel, userId: string, feeBreakdown: FeeBreakdown, idempotencyKey: string) {
      const paymentIntent = await this.stripe.paymentIntents.create(
      {
        amount: feeBreakdown.totalAmount * 100,
        currency: 'inr',
        metadata: {
          claimId: claim.id,
          userId,
          itemId: item.id ?? '',
        },
        automatic_payment_methods: { enabled: true },
        description: `Recovery fee — ${item.description.substring(0, 40)} (Claim ${claim.id})`,
      },
      { idempotencyKey },
    );

    this.validate([
        { check: () => !paymentIntent.client_secret, error: () => new InternalServerError('Failed to create payment intent') }
    ]);

    claim.feeDetails = {
      ...feeBreakdown,
      transactionId: paymentIntent.id,
    };
    await claim.save();

    return {
      clientSecret: paymentIntent.client_secret!,
      breakdown: feeBreakdown,
      paymentIntentId: paymentIntent.id,
    };
  }

  async verifyPayment(paymentIntentId: string, claimId: string, userId: string): Promise<IClaimModel> {
    const claim = await Claim.findById(claimId).populate('itemId');
    // Also need to dynamically import Storage to compare branch/city accurately
    const { default: Storage } = await import('../storage/storage.model');
    
    this.validate([
        { check: () => !claim, error: () => new NotFoundError('Claim not found') },
        { check: () => claim?.claimantId?.toString() !== userId, error: () => new AuthorizationError() },
    ]);

    const isPaid = claim!.paymentStatus === PaymentStatus.PAID;
    
    const handlePaid = async () => claim!;
    
    const handleUnpaid = async () => {
        this.validate([
             { 
                 check: () => Boolean(claim!.feeDetails?.transactionId && claim!.feeDetails.transactionId !== paymentIntentId), 
                 error: () => new ValidationError('Payment intent mismatch. Please try again.') 
             }
        ]);

        const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId);

        this.validate([
            { check: () => paymentIntent.status !== 'succeeded', error: () => new ValidationError(`Payment not successful. Status: ${paymentIntent.status}`) },
            { check: () => paymentIntent.metadata.claimId !== claim!.id, error: () => new AuthorizationError('Payment intent does not belong to this claim') }
        ]);

        const item = claim!.itemId as IItemModel;
        this.validate([{ check: () => !item, error: () => new InternalServerError('Item not found') }]);

        const feeBreakdown = this.calculateFee(item);

        claim!.paymentStatus = PaymentStatus.PAID;
        claim!.feeDetails = {
            ...feeBreakdown,
            paidAt: new Date(),
            transactionId: paymentIntent.id,
        };

        // Transfer Logic Integration
        const isDisposed = item.status === ItemStatus.DISPOSED;
        const getStrId = (val: string | mongoose.Types.ObjectId | { _id: mongoose.Types.ObjectId } | undefined | null): string => {
            if (!val) return '';
            if (typeof val === 'string') return val;
            if (val instanceof mongoose.Types.ObjectId) return val.toString();
            if (typeof val === 'object' && '_id' in val) return (val as { _id: mongoose.Types.ObjectId })._id.toString();
            return String(val);
        };
        const preferredLocStr = getStrId(claim!.preferredPickupLocation);
        const storageLocStr = getStrId(item.storageLocation);

        let isTransferNeeded = isDisposed;
        if (!isDisposed && preferredLocStr && storageLocStr && preferredLocStr !== storageLocStr) {
            // Detailed comparison if IDs don't strictly match
            const preferredLoc = await Storage.findById(preferredLocStr).lean();
            const currentLoc = await Storage.findById(storageLocStr).lean();
            
            if (preferredLoc && currentLoc) {
                // Transfer is needed if it's a completely different building/city.
                isTransferNeeded = preferredLoc.name !== currentLoc.name || preferredLoc.city !== currentLoc.city;
            } else {
                 isTransferNeeded = true;
            }
        }

        const postPaymentMap: Record<string, () => Promise<void>> = {
          true: async () => {
             claim!.status = isDisposed ? ClaimStatus.AWAITING_RECOVERY : ClaimStatus.AWAITING_TRANSFER;
             await transferService.createTransfer({
               claimId: claim!._id.toString(),
               itemId: item._id.toString(),
               fromStorageId: (item.storageLocation || claim!.preferredPickupLocation || '').toString(),
               toStorageId: (claim!.preferredPickupLocation || '').toString(),
               status: isDisposed ? TransferStatus.RECOVERY_REQUIRED : TransferStatus.PENDING,
               createdBy: userId,
               notes: isDisposed ? `Item was previously marked as ${item.status}. Recovery effort required.` : undefined
             });
          },
          false: async () => {
             claim!.status = ClaimStatus.VERIFIED; // Ready for pickup booking
          }
        };

        await postPaymentMap[String(!!isTransferNeeded)]();
        await claim!.save();

        const populatedItem = claim!.itemId as IItemModel;

        notificationService.queueNotification({
            event: NotificationEvent.PAYMENT_RECEIVED,
            userId,
            data: {
                claimId,
                claimantName: 'there',
                itemDescription: populatedItem?.description ?? 'your item',
                handlingFee: feeBreakdown.handlingFee,
                storageFee: feeBreakdown.storageFee,
                daysStored: feeBreakdown.daysStored,
                totalAmount: feeBreakdown.totalAmount,
                paidAt: claim!.feeDetails!.paidAt!,
                transactionId: `pi_...${paymentIntent.id.slice(-6)}`,
                isTransferNeeded: !!isTransferNeeded,
                destinationName: (claim!.preferredPickupLocation as unknown as IStorage)?.city || 'the selected location'
            },
        }).catch((err: unknown) => console.error('Failed to queue PAYMENT_RECEIVED notification:', err));

        activityService.logActivity({
            action: ActivityAction.PAYMENT_COMPLETED,
            userId,
            entityType: 'Claim',
            entityId: claimId,
            metadata: { 
                amount: feeBreakdown.totalAmount, 
                transactionId: paymentIntent.id 
            },
        }).catch(err => console.error('Failed to log payment activity:', err));

        return claim!;
    };

    const strategy = {
        true: handlePaid,
        false: handleUnpaid
    };
    
    const key = String(isPaid) as keyof typeof strategy;
    return strategy[key]();
  }
}

export default new PaymentService();
