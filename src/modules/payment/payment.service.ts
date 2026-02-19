import Stripe from 'stripe';
import { IItemModel, IClaimModel, PaymentStatus, FeeBreakdown, NotificationEvent } from '../../common/types';
import Claim from '../claim/claim.model';
import notificationService from '../notification/notification.service';
import { NotFoundError, AuthorizationError, ValidationError, InternalServerError } from '../../common/errors';
//remove all comment 
class PaymentService {
  private stripe: Stripe;
  private readonly HANDLING_FEE = 40;       
  private readonly STORAGE_FEE_PER_DAY = 5; 

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
    const storageFee = daysStored * this.STORAGE_FEE_PER_DAY;
    const totalAmount = this.HANDLING_FEE + storageFee;
    return { handlingFee: this.HANDLING_FEE, storageFee, daysStored, totalAmount };
  }


  async getFeeBreakdown(claimId: string, userId: string): Promise<FeeBreakdown> {
    const claim = await Claim.findById(claimId).populate('itemId');

    if (!claim) throw new NotFoundError('Claim not found');
    if (claim.claimantId.toString() !== userId) throw new AuthorizationError();
    if (claim.status !== 'VERIFIED') throw new ValidationError('Claim must be verified');
    if (!claim.itemId) throw new InternalServerError('Item missing from claim');

    return this.calculateFee(claim.itemId as unknown as IItemModel);
  }

  

  async createPaymentIntent(
    claimId: string,
    userId: string,
    idempotencyKey: string,
  ): Promise<{ clientSecret: string; breakdown: FeeBreakdown; paymentIntentId: string }> {
    const claim = await Claim.findById(claimId).populate('itemId');

    if (!claim) throw new NotFoundError('Claim not found');
    if (claim.claimantId.toString() !== userId) throw new AuthorizationError();
    if (claim.status !== 'VERIFIED') throw new ValidationError('Claim must be verified before payment');
    if (claim.paymentStatus === PaymentStatus.PAID) throw new ValidationError('Payment already completed');
    if (!claim.itemId) throw new InternalServerError('Item details not available');

    const item = claim.itemId as unknown as IItemModel;
    const feeBreakdown = this.calculateFee(item);

    // ── Server-side idempotency: reuse existing incomplete intent ──
    const existingIntentId = claim.feeDetails?.transactionId;
    if (existingIntentId) {
      try {
        const existing = await this.stripe.paymentIntents.retrieve(existingIntentId);
        if (existing.status !== 'succeeded' && existing.status !== 'canceled') {
          const clientSecret = existing.client_secret;
          if (!clientSecret) throw new InternalServerError('Stored payment intent has no client secret');
          return { clientSecret, breakdown: feeBreakdown, paymentIntentId: existing.id };
        }
      } catch {
        // Intent not found or expired on Stripe — fall through to create a new one
      }
    }

    const paymentIntent = await this.stripe.paymentIntents.create(
      {
        amount: feeBreakdown.totalAmount * 100, // paise
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

    if (!paymentIntent.client_secret) throw new InternalServerError('Failed to create payment intent');

  
    claim.feeDetails = {
      ...feeBreakdown,
      transactionId: paymentIntent.id,
    };
    await claim.save();

    return {
      clientSecret: paymentIntent.client_secret,
      breakdown: feeBreakdown,
      paymentIntentId: paymentIntent.id,
    };
  }


  async verifyPayment(paymentIntentId: string, claimId: string, userId: string): Promise<IClaimModel> {

    const claim = await Claim.findById(claimId).populate('itemId');
    if (!claim) throw new NotFoundError('Claim not found');
    if (claim.claimantId.toString() !== userId) throw new AuthorizationError();

 
    if (claim.paymentStatus === PaymentStatus.PAID) return claim;

  
    if (claim.feeDetails?.transactionId && claim.feeDetails.transactionId !== paymentIntentId) {
      throw new ValidationError('Payment intent mismatch. Please try again.');
    }

    
    const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== 'succeeded') {
      throw new ValidationError(`Payment not successful. Status: ${paymentIntent.status}`);
    }

   
    if (paymentIntent.metadata.claimId !== claim.id) {
      throw new AuthorizationError('Payment intent does not belong to this claim');
    }

    const item = claim.itemId as unknown as IItemModel;
    if (!item) throw new InternalServerError('Item not found');

    const feeBreakdown = this.calculateFee(item);

    claim.paymentStatus = PaymentStatus.PAID;
    claim.feeDetails = {
      ...feeBreakdown,
      paidAt: new Date(),
      transactionId: paymentIntent.id,
    };
    await claim.save();

    
    const populatedItem = claim.itemId as unknown as { description: string };
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
        paidAt: claim.feeDetails!.paidAt!,
        transactionId: `pi_...${paymentIntent.id.slice(-6)}`, 
      },
    }).catch(err => console.error('Failed to queue PAYMENT_RECEIVED notification:', err));

    return claim;
  }
}

export default new PaymentService();
