import { NotificationEvent } from '../../common/types';

export interface NotificationPayload {
  event: NotificationEvent;
  userId: string;
  data: Record<string, unknown>;
}

export interface EmailTemplate {
  subject: string;
  html: string;
}
