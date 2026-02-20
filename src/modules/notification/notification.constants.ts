import { NotificationEvent } from '../../common/types';
import { EmailTemplate } from './notification.types';

// ─── Template file registry (event → .hbs filename) ───────────────────────
export const TEMPLATE_FILES: Record<NotificationEvent, string> = {
  [NotificationEvent.MATCH_FOUND]:             'match-found.hbs',
  [NotificationEvent.CLAIM_STATUS_UPDATE]:     'claim-status-update.hbs',
  [NotificationEvent.RETENTION_EXPIRY_WARNING]:'retention-expiry-warning.hbs',
  [NotificationEvent.PICKUP_REMINDER]:         'pickup-reminder.hbs',
  [NotificationEvent.EMAIL_VERIFICATION]:      'email-verification.hbs',
  [NotificationEvent.PROOF_REQUESTED]:         'proof-requested.hbs',
  [NotificationEvent.PICKUP_BOOKED]:           'pickup-booked.hbs',
  [NotificationEvent.PAYMENT_REQUIRED]:        'payment-required.hbs',
  [NotificationEvent.PAYMENT_RECEIVED]:        'payment-received.hbs',
  [NotificationEvent.ANONYMOUS_CLAIM_CREATED]: 'anonymous-claim-created.hbs',
  [NotificationEvent.TRANSFER_SENT]:           'transfer-sent.hbs',
  [NotificationEvent.TRANSFER_ARRIVED]:        'transfer-arrived.hbs',
  [NotificationEvent.NEW_CLAIM_PENDING]:       'new-claim-pending.hbs',
  [NotificationEvent.PICKUP_COMPLETED]:        'pickup-completed.hbs',
};

// ─── Email subjects ────────────────────────────────────────────────────────
export type SubjectResolver = string | ((d: Record<string, unknown>) => string);

export const EMAIL_SUBJECTS: Record<NotificationEvent, SubjectResolver> = {
  [NotificationEvent.MATCH_FOUND]:             'Potential Match Found for Your Lost Item',
  [NotificationEvent.CLAIM_STATUS_UPDATE]:     (d) => `Claim Status Update: ${d.status}`,
  [NotificationEvent.RETENTION_EXPIRY_WARNING]:'Item Retention Expiring Soon',
  [NotificationEvent.PICKUP_REMINDER]:         'Pickup Reminder — Tomorrow',
  [NotificationEvent.EMAIL_VERIFICATION]:      'Verify Your Email Address',
  [NotificationEvent.PROOF_REQUESTED]:         'Proof of Ownership Required',
  [NotificationEvent.PICKUP_BOOKED]:           'Your Pickup Has Been Confirmed',
  [NotificationEvent.PAYMENT_REQUIRED]:        (d) => `Action Required: Pay ₹${d.totalAmount} to Schedule Pickup`,
  [NotificationEvent.PAYMENT_RECEIVED]:        (d) => `Payment Confirmed — ₹${d.totalAmount} Received`,
  [NotificationEvent.ANONYMOUS_CLAIM_CREATED]: 'Claim Received - Anonymous',
  [NotificationEvent.TRANSFER_SENT]:           (d) => `Item Transfer Initiated to ${d.destinationName}`,
  [NotificationEvent.TRANSFER_ARRIVED]:        (d) => `Item Ready For Pickup at ${d.destinationName}`,
  [NotificationEvent.NEW_CLAIM_PENDING]:       (d) => `New Claim Filed: ${d.itemDescription}`,
  [NotificationEvent.PICKUP_COMPLETED]:        'Pickup Successful — Item Collected',
};

// ─── Plain-text fallback templates (used when .hbs file is missing) ────────
export const FALLBACK_TEMPLATES: Record<NotificationEvent, (d: Record<string, unknown>, clientUrl: string) => EmailTemplate> = {
  [NotificationEvent.MATCH_FOUND]: (d, url) => ({
    subject: 'Potential Match Found for Your Lost Item',
    html: `<h2>Great News!</h2><p>We found a potential match (${((d.confidenceScore as number) * 100).toFixed(0)}% confidence).</p><p><a href="${url}/matches/${d.matchId}">View Match</a></p>`,
  }),
  [NotificationEvent.CLAIM_STATUS_UPDATE]: (d, url) => ({
    subject: `Claim Status Update: ${d.status}`,
    html: `<h2>Status Updated</h2><p>Your claim is now: <strong>${d.status}</strong></p>${d.notes ? `<p>${d.notes}</p>` : ''}<p><a href="${url}/claims/${d.claimId}">View Claim</a></p>`,
  }),
  [NotificationEvent.RETENTION_EXPIRY_WARNING]: (d) => ({
    subject: 'Item Retention Expiring Soon',
    html: `<h2>Retention Expiry Warning</h2><p>Your item will be disposed in <strong>${d.daysRemaining} days</strong>. Please take action.</p>`,
  }),
  [NotificationEvent.PICKUP_REMINDER]: (d) => ({
    subject: 'Pickup Reminder — Tomorrow',
    html: `<h2>Pickup Reminder</h2><p><strong>${d.pickupDate}</strong>, ${d.startTime}–${d.endTime}</p><p>Reference: <code>${d.referenceCode}</code></p>`,
  }),
  [NotificationEvent.EMAIL_VERIFICATION]: (d, url) => ({
    subject: 'Verify Your Email Address',
    html: `<h2>Verify Your Email</h2><p><a href="${url}/verify-email?token=${d.token}">Click here to verify your email</a>. This link expires in 24 hours.</p>`,
  }),
  [NotificationEvent.PROOF_REQUESTED]: (d, url) => ({
    subject: 'Proof of Ownership Required',
    html: `<h2>Proof Required</h2><p>Please upload proof of ownership for your claim.</p>
           ${d.question ? `<p><strong>Challenge Question:</strong> ${d.question}</p>` : ''}
           <p><a href="${url}/claims/${d.claimId}">View Claim</a></p>`,
  }),
  [NotificationEvent.PICKUP_BOOKED]: (d) => ({
    subject: 'Your Pickup Has Been Confirmed',
    html: `<h2>Pickup Confirmed</h2><p>${new Date(d.pickupDate as string).toLocaleDateString('en-IN')}, ${d.startTime}–${d.endTime}</p><p>Reference: <code>${d.referenceCode}</code></p>`,
  }),
  [NotificationEvent.PAYMENT_REQUIRED]: (d, url) => ({
    subject: `Action Required: Pay ₹${d.totalAmount} to Schedule Pickup`,
    html: `<h2>Payment Required</h2><p>Hi ${d.claimantName},</p><p>Your claim is verified. Please pay <strong>₹${d.totalAmount}</strong> to schedule pickup.</p><p><a href="${url}/claims/${d.claimId}">Pay Now</a></p>`,
  }),
  [NotificationEvent.PAYMENT_RECEIVED]: (d, url) => ({
    subject: `Payment Confirmed — ₹${d.totalAmount} Received`,
    html: `<h2>Payment Received</h2><p>Hi ${d.claimantName},</p><p>₹<strong>${d.totalAmount}</strong> received on ${d.paidAt}.</p>
           ${d.isTransferNeeded 
             ? `<p>We are now moving your item to <strong>${d.destinationName}</strong>. You will be notified as soon as it arrives so you can schedule your pickup.</p>` 
             : '<p>You can now schedule your pickup.</p>'}
           <p><a href="${url}/claims/${d.claimId}">View Claim Status</a></p>`,
  }),
  [NotificationEvent.ANONYMOUS_CLAIM_CREATED]: (d, url) => ({
    subject: 'Claim Received - Anonymous',
    html: `<h2>Claim Received</h2><p>Your anonymous claim has been recorded.</p><p><strong>Claim Token:</strong> <code>${d.token}</code></p><p>To track status and manage this claim, please <a href="${url}/register?email=${d.recipientEmail || ''}">create an account</a> or <a href="${url}/login">log in</a> with this email.</p>`,
  }),
  [NotificationEvent.TRANSFER_SENT]: (d, url) => ({
    subject: `Item Transfer Initiated to ${d.destinationName}`,
    html: `<h2>Transfer Started</h2><p>Your item is on its way to ${d.destinationName}. ${d.estimatedArrival ? `It is estimated to arrive by <strong>${new Date(d.estimatedArrival as string).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>.` : ''} You'll be notified when it arrives.</p><p><a href="${url}/claims/${d.claimId}">View Claim Status</a></p>`,
  }),
  [NotificationEvent.TRANSFER_ARRIVED]: (d, url) => ({
    subject: `Item Ready For Pickup at ${d.destinationName}`,
    html: `<h2>Ready for Pickup</h2><p>Your item has arrived at ${d.destinationName} and is ready for collection.</p><p><a href="${url}/claims/${d.claimId}">Schedule Pickup</a></p>`,
  }),
  [NotificationEvent.NEW_CLAIM_PENDING]: (d, url) => ({
    subject: `New Claim Filed: ${d.itemDescription}`,
    html: `<h2>New Claim Received</h2><p>A new claim has been filed for item: <strong>${d.itemDescription}</strong>.</p><p><a href="${url}/admin/claims/${d.claimId}">Review Claim</a></p>`,
  }),
  [NotificationEvent.PICKUP_COMPLETED]: (d, url) => ({
    subject: 'Pickup Successful — Item Collected',
    html: `<h2>Pickup Completed</h2><p>Great news! Your item has been successfully collected.</p><p>Thank you for using our platform.</p><p><a href="${url}/claims/${d.claimId}">View Receipt</a></p>`,
  }),
};
