import { NotificationEvent } from '../../common/types';

export enum NotificationChannel {
  EMAIL = 'EMAIL',
  SMS = 'SMS',
  PUSH = 'PUSH',
}

export interface NotificationPayload {
  userId?: string;
  recipientEmail?: string;
  recipientPhone?: string;
  event: NotificationEvent;
  data: Record<string, unknown>;
  channels?: NotificationChannel[];
  notificationId?: string;
  referenceId?: string;
}

export interface EmailTemplate {
  subject: string;
  html: string;
}
