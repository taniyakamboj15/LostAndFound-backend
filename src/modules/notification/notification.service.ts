import { notificationQueue } from './notification.queue';
import { NotificationPayload, EmailTemplate } from './notification.types';
import { NotificationEvent } from '../../common/types';
import User from '../user/user.model';
import transporter from '../../config/email';
import handlebars from 'handlebars';
import logger from '../../common/utils/logger';
import fs from 'fs';
import path from 'path';

// ─── Template file registry (event → .hbs filename) ───────────────────────
const TEMPLATE_FILES: Record<NotificationEvent, string> = {
  [NotificationEvent.MATCH_FOUND]:             'match-found.hbs',
  [NotificationEvent.CLAIM_STATUS_UPDATE]:     'claim-status-update.hbs',
  [NotificationEvent.RETENTION_EXPIRY_WARNING]:'retention-expiry-warning.hbs',
  [NotificationEvent.PICKUP_REMINDER]:         'pickup-reminder.hbs',
  [NotificationEvent.EMAIL_VERIFICATION]:      'email-verification.hbs',
  [NotificationEvent.PROOF_REQUESTED]:         'proof-requested.hbs',
  [NotificationEvent.PICKUP_BOOKED]:           'pickup-booked.hbs',
  [NotificationEvent.PAYMENT_REQUIRED]:        'payment-required.hbs',
  [NotificationEvent.PAYMENT_RECEIVED]:        'payment-received.hbs',
};

// ─── Email subjects ────────────────────────────────────────────────────────
type SubjectResolver = string | ((d: Record<string, unknown>) => string);

const EMAIL_SUBJECTS: Record<NotificationEvent, SubjectResolver> = {
  [NotificationEvent.MATCH_FOUND]:             'Potential Match Found for Your Lost Item',
  [NotificationEvent.CLAIM_STATUS_UPDATE]:     (d) => `Claim Status Update: ${d.status}`,
  [NotificationEvent.RETENTION_EXPIRY_WARNING]:'Item Retention Expiring Soon',
  [NotificationEvent.PICKUP_REMINDER]:         'Pickup Reminder — Tomorrow',
  [NotificationEvent.EMAIL_VERIFICATION]:      'Verify Your Email Address',
  [NotificationEvent.PROOF_REQUESTED]:         'Proof of Ownership Required',
  [NotificationEvent.PICKUP_BOOKED]:           'Your Pickup Has Been Confirmed',
  [NotificationEvent.PAYMENT_REQUIRED]:        (d) => `Action Required: Pay ₹${d.totalAmount} to Schedule Pickup`,
  [NotificationEvent.PAYMENT_RECEIVED]:        (d) => `Payment Confirmed — ₹${d.totalAmount} Received`,
};

// ─── Plain-text fallback templates (used when .hbs file is missing) ────────
const FALLBACK_TEMPLATES: Record<NotificationEvent, (d: Record<string, unknown>, clientUrl: string) => EmailTemplate> = {
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
    html: `<h2>Proof Required</h2><p>Please upload proof of ownership for your claim.</p><p><a href="${url}/claims/${d.claimId}/upload-proof">Upload Proof</a></p>`,
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
    html: `<h2>Payment Received</h2><p>Hi ${d.claimantName},</p><p>₹<strong>${d.totalAmount}</strong> received on ${d.paidAt}.</p><p>You can now schedule your pickup.</p><p><a href="${url}/claims/${d.claimId}">Schedule Pickup</a></p>`,
  }),
};

// ─── Service ───────────────────────────────────────────────────────────────

class NotificationService {
  private readonly templates = new Map<NotificationEvent, HandlebarsTemplateDelegate>();
  private readonly templateDir = path.join(__dirname, '../../templates/emails');
  private readonly clientUrl = process.env.CLIENT_URL ?? 'http://localhost:3000';

  constructor() {
    this.registerHelpers();
    this.loadTemplates();
  }

  // ── BullMQ ────────────────────────────────────────────────────────────────

  /**
   * Queue a notification job. Uses a 30-second deduplication window via jobId
   * so that rapid retries or duplicate triggers don't send multiple emails.
   */
  async queueNotification(payload: NotificationPayload): Promise<void> {
    const windowId = Math.floor(Date.now() / 30_000);
    await notificationQueue.add('send-notification', payload, {
      jobId: `${payload.event}-${payload.userId}-${windowId}`,
    });
  }

  // ── Worker entry point ────────────────────────────────────────────────────

  /**
   * Called by the BullMQ worker for each job. Resolves the recipient user,
   * injects their name into the template context, and sends the email.
   */
  async processNotification(payload: NotificationPayload): Promise<void> {
    const user = await User.findById(payload.userId).select('name email').lean();
    if (!user) throw new Error(`User not found: ${payload.userId}`);

    // Inject the resolved user name so templates can use {{claimantName}} / {{userName}}
    const enrichedData: Record<string, unknown> = {
      ...payload.data,
      claimantName: user.name,
      userName: user.name,
    };

    const template = this.buildTemplate(payload.event, enrichedData);
    await this.sendEmail(user.email, template);
  }

  // ── Email sender ──────────────────────────────────────────────────────────

  async sendEmail(to: string, template: EmailTemplate): Promise<void> {
    await transporter.sendMail({
      from: `"Lost & Found" <${process.env.EMAIL_FROM}>`,
      to,
      subject: template.subject,
      html: template.html,
    });
  }

  // ── Template rendering ────────────────────────────────────────────────────

  private buildTemplate(event: NotificationEvent, data: Record<string, unknown>): EmailTemplate {
    const subject = this.resolveSubject(event, data);
    const compiledTemplate = this.templates.get(event);

    if (!compiledTemplate) {
      // .hbs file wasn't found at startup — use fallback plain-HTML template
      logger.warn(`No Handlebars template registered for event "${event}", using fallback`);
      return FALLBACK_TEMPLATES[event](data, this.clientUrl);
    }

    const context: Record<string, unknown> = {
      ...data,
      clientUrl: this.clientUrl,
      year: new Date().getFullYear(),
    };

    // Normalise specific fields for consistent template rendering
    if (event === NotificationEvent.MATCH_FOUND && typeof data.confidenceScore === 'number') {
      context.confidenceScore = Math.round(data.confidenceScore * 100);
    }

    if (event === NotificationEvent.PAYMENT_RECEIVED) {
      const raw = data.paidAt;
      const date = raw instanceof Date ? raw : raw ? new Date(raw as string) : null;
      context.paidAt = date
        ? date.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
        : '';
    }

    return { subject, html: compiledTemplate(context) };
  }

  private resolveSubject(event: NotificationEvent, data: Record<string, unknown>): string {
    const resolver = EMAIL_SUBJECTS[event];
    return typeof resolver === 'function' ? resolver(data) : resolver;
  }

  // ── Startup: register Handlebars helpers and load .hbs template files ─────

  private registerHelpers(): void {
    handlebars.registerHelper('eq', (a: unknown, b: unknown) => a === b);
    handlebars.registerHelper('formatCurrency', (amount: number) =>
      `₹${Number(amount).toFixed(2)}`
    );
  }

  private loadTemplates(): void {
    const partialsDir = path.join(this.templateDir, 'partials');

    if (fs.existsSync(partialsDir)) {
      fs.readdirSync(partialsDir)
        .filter((f) => f.endsWith('.hbs'))
        .forEach((f) => {
          const name = path.basename(f, '.hbs');
          const source = fs.readFileSync(path.join(partialsDir, f), 'utf-8');
          handlebars.registerPartial(name, source);
        });
    }

    let loaded = 0;
    for (const [event, filename] of Object.entries(TEMPLATE_FILES)) {
      const filePath = path.join(this.templateDir, filename);
      if (fs.existsSync(filePath)) {
        const source = fs.readFileSync(filePath, 'utf-8');
        this.templates.set(event as NotificationEvent, handlebars.compile(source));
        loaded++;
      } else {
        logger.warn(`Email template not found: ${filename} (fallback will be used for "${event}")`);
      }
    }

    logger.info(`Notification service: ${loaded}/${Object.keys(TEMPLATE_FILES).length} email templates loaded`);
  }
}

export default new NotificationService();
