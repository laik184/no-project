export type NotificationType =
  | "run.completed"
  | "run.failed"
  | "deploy.success"
  | "deploy.failed"
  | "collab.invite"
  | "comment.mention"
  | "alert.triggered"
  | "billing.payment_failed"
  | "billing.usage_limit"
  | "security.login_new_device"
  | "system.maintenance";

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  actionUrl?: string;
  read: boolean;
  createdAt: Date;
  readAt?: Date;
  metadata?: Record<string, unknown>;
}

export interface NotificationPreferences {
  userId: string;
  channels: {
    inApp: boolean;
    email: boolean;
    push: boolean;
    webhook: boolean;
  };
  types: Partial<Record<NotificationType, {
    inApp: boolean;
    email: boolean;
    push: boolean;
  }>>;
  webhookUrl?: string;
  digestFrequency: "realtime" | "hourly" | "daily" | "weekly";
}

export interface PushSubscription {
  userId: string;
  endpoint: string;
  keys: { p256dh: string; auth: string };
  createdAt: Date;
}

export interface EmailTemplate {
  type: NotificationType;
  subject: string;
  htmlTemplate: string;
  textTemplate: string;
}

export interface WebhookPayload {
  event: NotificationType;
  ts: number;
  data: Record<string, unknown>;
  signature: string;
}
