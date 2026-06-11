// 안전 프로토콜의 알림 채널 인터페이스

export interface NotificationPayload {
  readonly userId: string;
  readonly guardianId?: string;
  readonly recipientEmail?: string;
  readonly recipientPhone?: string;
  readonly templateId: string;
  readonly vars: Readonly<Record<string, string>>;
}

export interface NotificationResult {
  readonly channelId: string;
  readonly status: 'success' | 'failed';
  readonly attempts: number;
  readonly attemptTimestamps: ReadonlyArray<Date>;
  readonly errorCode?: string;
}

export interface ScheduleHandle {
  readonly scheduleId: string;
  readonly scheduledFor: Date;
  cancel(): Promise<void>;
}

export interface NotificationChannelAdapter {
  readonly channelId: string;

  send(payload: NotificationPayload): Promise<NotificationResult>;

  schedule?(payload: NotificationPayload, atTime: Date): Promise<ScheduleHandle>;
}
