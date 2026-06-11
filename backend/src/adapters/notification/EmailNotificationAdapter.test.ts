// EmailNotificationAdapter 단위 테스트
import { describe, expect, it, vi } from 'vitest';

import {
  EmailNotificationAdapter,
  GUARDIAN_ALERT_BODY,
  GUARDIAN_ALERT_SUBJECT,
  type EmailSender,
} from './EmailNotificationAdapter.js';
import type { NotificationPayload } from './NotificationChannelAdapter.js';

function recordingSender(): {
  sender: EmailSender;
  calls: Array<{ to: string; subject: string; body: string }>;
} {
  const calls: Array<{ to: string; subject: string; body: string }> = [];
  return {
    calls,
    sender: {
      async send(args): Promise<void> {
        calls.push(args);
      },
    },
  };
}

function throwingSender(err: Error): EmailSender {
  return {
    async send(): Promise<void> {
      throw err;
    },
  };
}

const basePayload: NotificationPayload = {
  userId: 'user-1',
  guardianId: 'guardian-1',
  recipientEmail: 'guardian@example.com',
  templateId: 'high_risk_guardian_alert',
  vars: {},
};

describe('EmailNotificationAdapter — channelId', () => {
  it("channelId는 'email'이다", () => {
    const adapter = new EmailNotificationAdapter({ sender: recordingSender().sender });
    expect(adapter.channelId).toBe('email');
  });
});

describe('EmailNotificationAdapter.send — 성공 경로', () => {
  it('수신처가 있으면 sender를 호출하고 success를 반환한다', async () => {
    const { sender, calls } = recordingSender();
    const fixedNow = new Date('2026-01-01T00:00:00.000Z');
    const adapter = new EmailNotificationAdapter({ sender, clock: () => fixedNow });

    const result = await adapter.send(basePayload);

    expect(result).toEqual({
      channelId: 'email',
      status: 'success',
      attempts: 1,
      attemptTimestamps: [fixedNow],
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.to).toBe('guardian@example.com');
  });

  it('기본 제목/본문은 PII 미포함 고정 문구를 사용한다', async () => {
    const { sender, calls } = recordingSender();
    const adapter = new EmailNotificationAdapter({ sender });

    await adapter.send(basePayload);

    expect(calls[0]?.subject).toBe(GUARDIAN_ALERT_SUBJECT);
    expect(calls[0]?.body).toBe(GUARDIAN_ALERT_BODY);
    expect(calls[0]?.body).not.toContain(basePayload.userId);
    expect(calls[0]?.body).not.toContain('guardian@example.com');
  });

  it('커스텀 제목/본문을 주입하면 그대로 사용한다', async () => {
    const { sender, calls } = recordingSender();
    const adapter = new EmailNotificationAdapter({
      sender,
      subject: '커스텀 제목',
      body: '커스텀 본문',
    });

    await adapter.send(basePayload);

    expect(calls[0]?.subject).toBe('커스텀 제목');
    expect(calls[0]?.body).toBe('커스텀 본문');
  });
});

describe('EmailNotificationAdapter.send — 수신처 누락', () => {
  it('recipientEmail이 없으면 failed(missing_recipient)를 반환하고 sender를 호출하지 않는다', async () => {
    const sender: EmailSender = { send: vi.fn(async () => undefined) };
    const adapter = new EmailNotificationAdapter({ sender });

    const { recipientEmail: _omit, ...withoutEmail } = basePayload;
    const result = await adapter.send(withoutEmail);

    expect(result).toEqual({
      channelId: 'email',
      status: 'failed',
      attempts: 0,
      attemptTimestamps: [],
      errorCode: 'missing_recipient',
    });
    expect(sender.send).not.toHaveBeenCalled();
  });

  it('recipientEmail이 빈 문자열이면 failed(missing_recipient)를 반환한다', async () => {
    const sender: EmailSender = { send: vi.fn(async () => undefined) };
    const adapter = new EmailNotificationAdapter({ sender });

    const result = await adapter.send({ ...basePayload, recipientEmail: '' });

    expect(result.status).toBe('failed');
    expect(result.errorCode).toBe('missing_recipient');
    expect(result.attempts).toBe(0);
    expect(sender.send).not.toHaveBeenCalled();
  });
});

describe('EmailNotificationAdapter.send — 전송 예외 흡수', () => {
  it('sender가 throw하면 failed로 변환하고 예외를 전파하지 않는다', async () => {
    const fixedNow = new Date('2026-02-02T00:00:00.000Z');
    const adapter = new EmailNotificationAdapter({
      sender: throwingSender(new Error('SES down')),
      clock: () => fixedNow,
    });

    const result = await adapter.send(basePayload);

    expect(result).toEqual({
      channelId: 'email',
      status: 'failed',
      attempts: 1,
      attemptTimestamps: [fixedNow],
      errorCode: 'Error',
    });
  });

  it('예외의 name을 errorCode로 보고한다', async () => {
    class ThrottlingException extends Error {
      public constructor() {
        super('rate limited');
        this.name = 'ThrottlingException';
      }
    }
    const adapter = new EmailNotificationAdapter({
      sender: throwingSender(new ThrottlingException()),
    });

    const result = await adapter.send(basePayload);

    expect(result.status).toBe('failed');
    expect(result.errorCode).toBe('ThrottlingException');
  });

  it('Error가 아닌 값이 throw되면 send_error로 보고한다', async () => {
    const adapter = new EmailNotificationAdapter({
      sender: {
        async send(): Promise<void> {
          throw 'string failure';
        },
      },
    });

    const result = await adapter.send(basePayload);

    expect(result.status).toBe('failed');
    expect(result.errorCode).toBe('send_error');
  });
});
