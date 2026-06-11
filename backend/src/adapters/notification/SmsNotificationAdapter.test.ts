// SmsNotificationAdapter 단위 테스트
import { describe, expect, it, vi } from 'vitest';

import type { NotificationPayload } from './NotificationChannelAdapter.js';
import {
  SmsNotificationAdapter,
  GUARDIAN_SMS_BODY,
  type SmsSender,
} from './SmsNotificationAdapter.js';

function recordingSender(): {
  sender: SmsSender;
  calls: Array<{ to: string; message: string }>;
} {
  const calls: Array<{ to: string; message: string }> = [];
  return {
    calls,
    sender: {
      async send(args): Promise<void> {
        calls.push(args);
      },
    },
  };
}

function throwingSender(err: Error): SmsSender {
  return {
    async send(): Promise<void> {
      throw err;
    },
  };
}

const basePayload: NotificationPayload = {
  userId: 'user-1',
  guardianId: 'guardian-1',
  recipientPhone: '+821012345678',
  templateId: 'high_risk_guardian_alert',
  vars: {},
};

describe('SmsNotificationAdapter — channelId', () => {
  it("channelId는 'sms'이다", () => {
    const adapter = new SmsNotificationAdapter({ sender: recordingSender().sender });
    expect(adapter.channelId).toBe('sms');
  });
});

describe('SmsNotificationAdapter.send — 성공 경로', () => {
  it('수신처가 있으면 sender를 호출하고 success를 반환한다', async () => {
    const { sender, calls } = recordingSender();
    const fixedNow = new Date('2026-01-01T00:00:00.000Z');
    const adapter = new SmsNotificationAdapter({ sender, clock: () => fixedNow });

    const result = await adapter.send(basePayload);

    expect(result).toEqual({
      channelId: 'sms',
      status: 'success',
      attempts: 1,
      attemptTimestamps: [fixedNow],
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.to).toBe('+821012345678');
  });

  it('기본 본문은 PII 미포함 고정 문구를 사용한다', async () => {
    const { sender, calls } = recordingSender();
    const adapter = new SmsNotificationAdapter({ sender });

    await adapter.send(basePayload);

    expect(calls[0]?.message).toBe(GUARDIAN_SMS_BODY);
    expect(calls[0]?.message).not.toContain(basePayload.userId);
    expect(calls[0]?.message).not.toContain('+821012345678');
  });

  it('커스텀 본문을 주입하면 그대로 사용한다', async () => {
    const { sender, calls } = recordingSender();
    const adapter = new SmsNotificationAdapter({ sender, message: '커스텀 SMS 본문' });

    await adapter.send(basePayload);

    expect(calls[0]?.message).toBe('커스텀 SMS 본문');
  });
});

describe('SmsNotificationAdapter.send — 수신처 누락', () => {
  it('recipientPhone이 없으면 failed(missing_recipient)를 반환하고 sender를 호출하지 않는다', async () => {
    const sender: SmsSender = { send: vi.fn(async () => undefined) };
    const adapter = new SmsNotificationAdapter({ sender });

    const { recipientPhone: _omit, ...withoutPhone } = basePayload;
    const result = await adapter.send(withoutPhone);

    expect(result).toEqual({
      channelId: 'sms',
      status: 'failed',
      attempts: 0,
      attemptTimestamps: [],
      errorCode: 'missing_recipient',
    });
    expect(sender.send).not.toHaveBeenCalled();
  });

  it('recipientPhone이 빈 문자열이면 failed(missing_recipient)를 반환한다', async () => {
    const sender: SmsSender = { send: vi.fn(async () => undefined) };
    const adapter = new SmsNotificationAdapter({ sender });

    const result = await adapter.send({ ...basePayload, recipientPhone: '' });

    expect(result.status).toBe('failed');
    expect(result.errorCode).toBe('missing_recipient');
    expect(result.attempts).toBe(0);
    expect(sender.send).not.toHaveBeenCalled();
  });
});

describe('SmsNotificationAdapter.send — 전송 예외 흡수', () => {
  it('sender가 throw하면 failed로 변환하고 예외를 전파하지 않는다', async () => {
    const fixedNow = new Date('2026-02-02T00:00:00.000Z');
    const adapter = new SmsNotificationAdapter({
      sender: throwingSender(new Error('SNS down')),
      clock: () => fixedNow,
    });

    const result = await adapter.send(basePayload);

    expect(result).toEqual({
      channelId: 'sms',
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
    const adapter = new SmsNotificationAdapter({
      sender: throwingSender(new ThrottlingException()),
    });

    const result = await adapter.send(basePayload);

    expect(result.status).toBe('failed');
    expect(result.errorCode).toBe('ThrottlingException');
  });

  it('Error가 아닌 값이 throw되면 send_error로 보고한다', async () => {
    const adapter = new SmsNotificationAdapter({
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
