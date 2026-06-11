// 보호자 SMS 안전 알림 채널 어댑터

import type {
  NotificationChannelAdapter,
  NotificationPayload,
  NotificationResult,
} from './NotificationChannelAdapter.js';

export const GUARDIAN_SMS_BODY =
  '[나,다움] 도움이 필요한 상황일 수 있습니다. 가까운 시일 내 안부를 확인해 주세요. 긴급 시 1393 / 1577-0199.';

export interface SmsSender {
  send(args: { to: string; message: string }): Promise<void>;
}

export interface SmsNotificationAdapterOptions {
  readonly sender: SmsSender;
  readonly message?: string;
  readonly clock?: () => Date;
}

export class SmsNotificationAdapter implements NotificationChannelAdapter {
  public readonly channelId = 'sms';

  private readonly sender: SmsSender;
  private readonly message: string;
  private readonly clock: () => Date;

  public constructor(options: SmsNotificationAdapterOptions) {
    this.sender = options.sender;
    this.message = options.message ?? GUARDIAN_SMS_BODY;
    this.clock = options.clock ?? ((): Date => new Date());
  }

  public async send(payload: NotificationPayload): Promise<NotificationResult> {
    const to = payload.recipientPhone;
    const attemptedAt = this.clock();
    if (typeof to !== 'string' || to.length === 0) {
      return {
        channelId: this.channelId,
        status: 'failed',
        attempts: 0,
        attemptTimestamps: [],
        errorCode: 'missing_recipient',
      };
    }
    try {
      await this.sender.send({ to, message: this.message });
      return {
        channelId: this.channelId,
        status: 'success',
        attempts: 1,
        attemptTimestamps: [attemptedAt],
      };
    } catch (err) {
      return {
        channelId: this.channelId,
        status: 'failed',
        attempts: 1,
        attemptTimestamps: [attemptedAt],
        errorCode: err instanceof Error ? err.name : 'send_error',
      };
    }
  }
}
