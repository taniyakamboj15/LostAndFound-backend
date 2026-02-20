import { pushQueue, emailQueue, smsQueue } from './notification.queue';
import { NotificationPayload, EmailTemplate } from './notification.types';
import { NotificationEvent } from '../../common/types';
import User from '../user/user.model';
import NotificationModel from './notification.model';
import transporter from '../../config/email';
import handlebars from 'handlebars';
import logger from '../../common/utils/logger';
import { TEMPLATE_FILES, EMAIL_SUBJECTS, FALLBACK_TEMPLATES } from './notification.constants';
import fs from 'fs';
import path from 'path';

class NotificationService {
  private readonly templates = new Map<NotificationEvent, HandlebarsTemplateDelegate>();
  private readonly templateDir = path.join(__dirname, '../../templates/emails');
  private readonly clientUrl = process.env.CLIENT_URL ?? 'http://localhost:3000';

  constructor() {
    this.registerHelpers();
    this.loadTemplates();
  }


  async queueNotification(payload: NotificationPayload): Promise<void> {
    await this.queueEscalatingNotification(payload);
  }

  /**
   * Multi-channel escalation:
   *  1. DB Notification created for tracking
   *  2. Push (in-app) immediately
   *  3. Email after 24 hours (if user has not responded / opted in)
   *  4. SMS after 72 hours
   */
  async queueEscalatingNotification(payload: Omit<NotificationPayload, 'channels'>): Promise<void> {
    const baseId = `${payload.event}-${payload.userId}-${Date.now()}`;
    
    let notificationDoc = null;
    let title = this.resolveSubject(payload.event, payload.data);

    // Fetch user preferences early
    let prefs = { channels: ['IN_APP', 'EMAIL', 'PUSH'], emailOptOut: false, smsOptOut: false };
    if (payload.userId) {
       const user = await User.findById(payload.userId).select('notificationPreferences').lean();
       if (user && user.notificationPreferences) {
           const p = user.notificationPreferences;
           prefs = {
               channels: p.channels || prefs.channels,
               emailOptOut: p.emailOptOut ?? prefs.emailOptOut,
               smsOptOut: p.smsOptOut ?? prefs.smsOptOut
           };
       }
    }
    const channels = prefs.channels || [];
    const emailOptOut = prefs.emailOptOut || false;
    const smsOptOut = prefs.smsOptOut || false;
    
    // Create DB notification if for a registered user
    if (payload.userId) {
       notificationDoc = await NotificationModel.create({
          userId: payload.userId,
          event: payload.event,
          title,
          body: title, // You could expand this to resolve a short body string
          data: payload.data,
          referenceId: payload.referenceId,
          channelsSent: [],
       });
    }

    const jobData = {
        ...payload,
        notificationId: notificationDoc?._id.toString()
    };

    // Step 1: In-app / push — immediate
    if (channels.includes('PUSH') || channels.includes('IN_APP') || !payload.userId) {
       await pushQueue.add('send-push', jobData, { jobId: `${baseId}-push` });
    }

    // Step 2: Email — immediate for urgent events, otherwise after 24h escalation
    const IMMEDIATE_EMAIL_EVENTS = new Set([
      NotificationEvent.TRANSFER_ARRIVED,
      NotificationEvent.TRANSFER_SENT,
      NotificationEvent.PAYMENT_RECEIVED,
      NotificationEvent.PICKUP_BOOKED,
      NotificationEvent.PROOF_REQUESTED,
    ]);

    if (!emailOptOut && channels.includes('EMAIL') && (payload.recipientEmail || payload.userId)) {
       const emailDelay = IMMEDIATE_EMAIL_EVENTS.has(payload.event)
         ? 0
         : parseInt(process.env.ESCALATION_EMAIL_DELAY_MS || '86400000');
       await emailQueue.add('send-email', jobData, {
           jobId: `${baseId}-email`,
           delay: emailDelay,
       });
    }

    if (!smsOptOut && channels.includes('SMS') && (payload.recipientPhone || payload.userId)) {
       await smsQueue.add('send-sms', jobData, {
           jobId: `${baseId}-sms`,
           delay: parseInt(process.env.ESCALATION_SMS_DELAY_MS || '259200000'),
       });
    }

    logger.info(`[Escalation] Queued verified escalation steps for user ${payload.userId}, event: ${payload.event}`);
  }

  /**
   * Broadcast a notification to all Admin and Staff users.
   */
  async notifyStaff(payload: Omit<NotificationPayload, 'userId'>): Promise<void> {
    const staffUsers = await User.find({
      role: { $in: ['ADMIN', 'STAFF'] }
    }).select('_id email notificationPreferences').lean();

    const tasks = staffUsers.map(staff => 
      this.queueEscalatingNotification({
        ...payload,
        userId: staff._id.toString()
      })
    );

    await Promise.all(tasks);
    logger.info(`[Broadcast] Queued notifications for ${staffUsers.length} staff members for event: ${payload.event}`);
  }

  // ── Worker specific entry points ──────────────────────────────────────────

  async processPush(payload: NotificationPayload): Promise<void> {
    if (!payload.userId) return; // Push requires a known app user

    const user = await User.findById(payload.userId).select('notificationPreferences').lean();
    if (!user) return;

    const prefs = user.notificationPreferences || { channels: ['IN_APP', 'EMAIL'] };
    const channels = prefs.channels || [];
    if (!channels.includes('PUSH') && !channels.includes('IN_APP')) {
        logger.info(`[Push] User ${payload.userId} opted out of PUSH. Skipping.`);
        return;
    }

    // Mark that push was "sent" in db
    if (payload.notificationId) {
       await NotificationModel.findByIdAndUpdate(payload.notificationId, { $addToSet: { channelsSent: 'PUSH' } });
    }

    logger.info(`[Push] In-app notification available for User ${payload.userId}: ${payload.event}`);
    // Real-time socket emit or Firebase FCM delivery would happen here.
  }

  async processEmail(payload: NotificationPayload): Promise<void> {
      // Escalation Check: If read in-app, skip!
      if (payload.notificationId) {
          const notif = await NotificationModel.findById(payload.notificationId).lean();
          if (notif && notif.isRead) {
              logger.info(`[Email] Notification ${payload.notificationId} already read. Skipping email.`);
              return;
          }
      }

      await this.resolveAndSendSingleChannel(payload, 'EMAIL');
  }

  async processSMS(payload: NotificationPayload): Promise<void> {
      // Escalation Check: If read in-app, skip!
      if (payload.notificationId) {
          const notif = await NotificationModel.findById(payload.notificationId).lean();
          if (notif && notif.isRead) {
              logger.info(`[SMS] Notification ${payload.notificationId} already read. Skipping SMS.`);
              return;
          }
      }
      
      await this.resolveAndSendSingleChannel(payload, 'SMS');
  }

  private async resolveAndSendSingleChannel(payload: NotificationPayload, channel: 'EMAIL' | 'SMS'): Promise<void> {

    let email = payload.recipientEmail;
    let name = (payload.data.userName || payload.data.claimantName || 'Customer') as string;

    if (payload.userId) {
      const user = await User.findById(payload.userId).select('name email phone notificationPreferences').lean();
      if (user) {
        // Preference check
        const prefs = user.notificationPreferences || { channels: ['IN_APP', 'EMAIL'] };
        const channels = prefs.channels || [];
        if (channel === 'EMAIL' && (user.notificationPreferences?.emailOptOut || !channels.includes('EMAIL'))) {
            logger.info(`[Email] User ${payload.userId} opted out of EMAIL. Skipping.`);
            return;
        }
        if (channel === 'SMS' && (user.notificationPreferences?.smsOptOut || !channels.includes('SMS'))) {
            logger.info(`[SMS] User ${payload.userId} opted out of SMS. Skipping.`);
            return;
        }

        email = user.email;
        name = user.name;
        if (!payload.recipientPhone) payload.recipientPhone = user.phone;
      }
    }

    if (channel === 'EMAIL' && !email) return;
    if (channel === 'SMS' && !payload.recipientPhone) return;

    const enrichedData = { ...payload.data, claimantName: name, userName: name };

    if (channel === 'EMAIL' && email) {
        const template = this.buildTemplate(payload.event, enrichedData);
        await this.sendEmail(email, template);
        if (payload.notificationId) await NotificationModel.findByIdAndUpdate(payload.notificationId, { $addToSet: { channelsSent: 'EMAIL' } });
    } else if (channel === 'SMS' && payload.recipientPhone) {
        await this.sendSMS(payload.recipientPhone, payload.event, enrichedData);
        if (payload.notificationId) await NotificationModel.findByIdAndUpdate(payload.notificationId, { $addToSet: { channelsSent: 'SMS' } });
    }
  }

  private async sendSMS(phone: string, event: NotificationEvent, _data: Record<string, unknown>) {
      logger.info(`[SMS] To ${phone}: ${event}`);
      // Mock integration for SMS as per implementation plan requirement
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
    handlebars.registerHelper('formatDate', (date: Date | string) => {
      if (!date) return '';
      const d = new Date(date);
      return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
    });
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
