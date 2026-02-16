import { notificationQueue } from './notification.queue';
import { NotificationPayload, EmailTemplate } from './notification.types';
import { NotificationEvent } from '../../common/types';
import User from '../user/user.model';
import transporter from '../../config/email';
import handlebars from 'handlebars';
import fs from 'fs';
import path from 'path';

class NotificationService {
  private templates: Map<NotificationEvent, HandlebarsTemplateDelegate> = new Map();

  constructor() {
    this.loadTemplates();
    this.registerHelpers();
  }

  private loadTemplates(): void {
    const templateDir = path.join(__dirname, '../../templates/emails');
    const partialsDir = path.join(templateDir, 'partials');

    // Load partials
    if (fs.existsSync(partialsDir)) {
      const partialFiles = fs.readdirSync(partialsDir);
      partialFiles.forEach((file) => {
        if (file.endsWith('.hbs')) {
          const partialName = path.basename(file, '.hbs');
          const partialSource = fs.readFileSync(
            path.join(partialsDir, file),
            'utf-8'
          );
          handlebars.registerPartial(partialName, partialSource);
        }
      });
    }

    const templateFiles: Record<NotificationEvent, string> = {
      [NotificationEvent.MATCH_FOUND]: 'match-found.hbs',
      [NotificationEvent.CLAIM_STATUS_UPDATE]: 'claim-status-update.hbs',
      [NotificationEvent.RETENTION_EXPIRY_WARNING]: 'retention-expiry-warning.hbs',
      [NotificationEvent.PICKUP_REMINDER]: 'pickup-reminder.hbs',
      [NotificationEvent.EMAIL_VERIFICATION]: 'email-verification.hbs',
      [NotificationEvent.PROOF_REQUESTED]: 'proof-requested.hbs',
      [NotificationEvent.PICKUP_BOOKED]: 'pickup-booked.hbs',
    };

    Object.entries(templateFiles).forEach(([event, filename]) => {
      const templatePath = path.join(templateDir, filename);
      if (fs.existsSync(templatePath)) {
        const templateSource = fs.readFileSync(templatePath, 'utf-8');
        this.templates.set(
          event as NotificationEvent,
          handlebars.compile(templateSource)
        );
      }
    });
  }

  private registerHelpers(): void {
    // Register Handlebars helper for equality check
    handlebars.registerHelper('eq', (a, b) => a === b);
  }

  async queueNotification(payload: NotificationPayload): Promise<void> {
    await notificationQueue.add('send-notification', payload);
  }

  async sendEmail(to: string, template: EmailTemplate): Promise<void> {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to,
      subject: template.subject,
      html: template.html,
    });
  }

  async processNotification(payload: NotificationPayload): Promise<void> {
    const user = await User.findById(payload.userId);

    if (!user) {
      throw new Error('User not found');
    }

    const template = this.getEmailTemplate(payload.event, payload.data);

    await this.sendEmail(user.email, template);
  }

  private getEmailTemplate(
    event: NotificationEvent,
    data: Record<string, unknown>
  ): EmailTemplate {
    const templateFunc = this.templates.get(event);

    if (!templateFunc) {
      // Fallback to simple HTML if template not found
      return this.getFallbackTemplate(event, data);
    }

    const context: Record<string, unknown> = {
      ...data,
      clientUrl: process.env.CLIENT_URL || 'http://localhost:3000',
      year: new Date().getFullYear(),
    };

    // Format specific data based on event
    if (
      event === NotificationEvent.MATCH_FOUND &&
      typeof data.confidenceScore === 'number'
    ) {
      context.confidenceScore = Math.round(data.confidenceScore * 100);
    }

    const html = templateFunc(context);
    const subject = this.getSubject(event, data);

    return { subject, html };
  }

  private getSubject(event: NotificationEvent, data: Record<string, unknown>): string {
    const subjects: Record<NotificationEvent, string | ((d: Record<string, unknown>) => string)> = {
      [NotificationEvent.MATCH_FOUND]: 'Potential Match Found for Your Lost Item',
      [NotificationEvent.CLAIM_STATUS_UPDATE]: (d) => `Claim Status Update: ${d.status}`,
      [NotificationEvent.RETENTION_EXPIRY_WARNING]: 'Item Retention Expiring Soon',
      [NotificationEvent.PICKUP_REMINDER]: 'Pickup Reminder - Tomorrow',
      [NotificationEvent.EMAIL_VERIFICATION]: 'Verify Your Email',
      [NotificationEvent.PROOF_REQUESTED]: 'Proof of Ownership Required',
      [NotificationEvent.PICKUP_BOOKED]: 'Pickup Confirmed',
    };

    const subject = subjects[event];
    return typeof subject === 'function' ? subject(data) : subject;
  }

  private getFallbackTemplate(
    event: NotificationEvent,
    data: Record<string, unknown>
  ): EmailTemplate {
    // Simple fallback templates
    const templates: Record<NotificationEvent, (data: Record<string, unknown>) => EmailTemplate> = {
      [NotificationEvent.MATCH_FOUND]: (d) => ({
        subject: 'Potential Match Found for Your Lost Item',
        html: `
          <h1>Great News!</h1>
          <p>We found a potential match for your lost item report.</p>
          <p><strong>Confidence Score:</strong> ${((d.confidenceScore as number) * 100).toFixed(0)}%</p>
          <p>Please visit your dashboard to review the match and file a claim if this is your item.</p>
          <a href="${process.env.CLIENT_URL}/matches/${d.matchId}">View Match</a>
        `,
      }),
      [NotificationEvent.CLAIM_STATUS_UPDATE]: (d) => ({
        subject: `Claim Status Update: ${d.status}`,
        html: `
          <h1>Claim Status Updated</h1>
          <p>Your claim status has been updated to: <strong>${d.status}</strong></p>
          ${d.notes ? `<p>Notes: ${d.notes}</p>` : ''}
          <a href="${process.env.CLIENT_URL}/claims/${d.claimId}">View Claim</a>
        `,
      }),
      [NotificationEvent.RETENTION_EXPIRY_WARNING]: (d) => ({
        subject: 'Item Retention Expiring Soon',
        html: `
          <h1>Retention Expiry Warning</h1>
          <p>The following item will be disposed of in ${d.daysRemaining} days:</p>
          <p><strong>Category:</strong> ${d.category}</p>
          <p><strong>Location Found:</strong> ${d.locationFound}</p>
          <p>Please take appropriate action before the expiry date.</p>
        `,
      }),
      [NotificationEvent.PICKUP_REMINDER]: (d) => ({
        subject: 'Pickup Reminder - Tomorrow',
        html: `
          <h1>Pickup Reminder</h1>
          <p>Your pickup is scheduled for tomorrow:</p>
          <p><strong>Date:</strong> ${d.pickupDate}</p>
          <p><strong>Time:</strong> ${d.startTime} - ${d.endTime}</p>
          <p><strong>Reference Code:</strong> ${d.referenceCode}</p>
          <p>Please bring a valid ID and your reference code.</p>
        `,
      }),
      [NotificationEvent.EMAIL_VERIFICATION]: (d) => ({
        subject: 'Verify Your Email',
        html: `
          <h1>Email Verification</h1>
          <p>Please verify your email address:</p>
          <a href="${process.env.CLIENT_URL}/verify-email?token=${d.token}">Verify Email</a>
          <p>This link expires in 24 hours.</p>
        `,
      }),
      [NotificationEvent.PROOF_REQUESTED]: (d) => ({
        subject: 'Proof of Ownership Required',
        html: `
          <h1>Proof Required</h1>
          <p>Please upload proof of ownership for your claim:</p>
          <ul>
            <li>Government-issued ID</li>
            <li>Purchase receipt or invoice</li>
            <li>Photos showing identifying features</li>
          </ul>
          <a href="${process.env.CLIENT_URL}/claims/${d.claimId}/upload-proof">Upload Proof</a>
        `,
      }),
      [NotificationEvent.PICKUP_BOOKED]: (d) => ({
        subject: 'Pickup Confirmed',
        html: `
          <h1>Pickup Confirmed</h1>
          <p>Your pickup has been successfully scheduled:</p>
          <p><strong>Date:</strong> ${new Date(d.pickupDate as string).toLocaleDateString()}</p>
          <p><strong>Time:</strong> ${d.startTime} - ${d.endTime}</p>
          <p><strong>Reference Code:</strong> ${d.referenceCode}</p>
          <div style="text-align: center; margin: 20px 0;">
            <img src="${d.qrCode}" alt="Pickup QR Code" style="width: 200px; height: 200px;" />
          </div>
          <p>Please bring a valid ID and this reference code to the storage location.</p>
        `,
      }),
    };

    return templates[event](data);
  }
}

export default new NotificationService();
