// 보호자 이메일 안전 알림 채널 어댑터

import type {
  NotificationChannelAdapter,
  NotificationPayload,
  NotificationResult,
} from './NotificationChannelAdapter.js';

export const GUARDIAN_ALERT_SUBJECT = '[나,다움] 안전 안내';
export const GUARDIAN_ALERT_BODY =
  '도움이 필요한 상황일 수 있습니다.\n\n' +
  '「나,다움」을 이용 중인 분과 가까운 시일 내에 연락해 안부를 확인해 주시기를 권합니다.\n' +
  '긴급한 도움이 필요하다면 자살예방상담전화 1393 또는 정신건강상담전화 1577-0199로 연락할 수 있습니다.\n\n' +
  '※ 본 메일은 보호자 알림에 동의한 경우 발송되며, 대화 내용은 포함하지 않습니다.';

export interface EmailSender {
  send(args: { to: string; subject: string; body: string }): Promise<void>;
}

export interface EmailNotificationAdapterOptions {
  readonly sender: EmailSender;
  readonly subject?: string;
  readonly body?: string;
  readonly clock?: () => Date;
}

export class EmailNotificationAdapter implements NotificationChannelAdapter {
  public readonly channelId = 'email';

  private readonly sender: EmailSender;
  private readonly subject: string;
  private readonly body: string;
  private readonly clock: () => Date;

  public constructor(options: EmailNotificationAdapterOptions) {
    this.sender = options.sender;
    this.subject = options.subject ?? GUARDIAN_ALERT_SUBJECT;
    this.body = options.body ?? GUARDIAN_ALERT_BODY;
    this.clock = options.clock ?? ((): Date => new Date());
  }

  public async send(payload: NotificationPayload): Promise<NotificationResult> {
    const to = payload.recipientEmail;
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
      await this.sender.send({ to, subject: this.subject, body: this.body });
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
