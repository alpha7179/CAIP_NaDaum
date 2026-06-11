// NotificationChannelRegistry 단위 테스트
import { describe, expect, it } from 'vitest';

import type {
  NotificationChannelAdapter,
  NotificationPayload,
  NotificationResult,
  ScheduleHandle,
} from '../../adapters/notification/NotificationChannelAdapter.js';

import { NotificationChannelRegistry } from './NotificationChannelRegistry.js';

function makeFakeAdapter(channelId: string): NotificationChannelAdapter {
  return {
    channelId,
    async send(_payload: NotificationPayload): Promise<NotificationResult> {
      return {
        channelId,
        status: 'success',
        attempts: 1,
        attemptTimestamps: [new Date(0)],
      };
    },
  };
}

function makeSchedulableAdapter(channelId: string): NotificationChannelAdapter {
  return {
    channelId,
    async send(_payload: NotificationPayload): Promise<NotificationResult> {
      return {
        channelId,
        status: 'success',
        attempts: 1,
        attemptTimestamps: [new Date(0)],
      };
    },
    async schedule(_payload: NotificationPayload, atTime: Date): Promise<ScheduleHandle> {
      return {
        scheduleId: `${channelId}-${atTime.toISOString()}`,
        scheduledFor: atTime,
        async cancel(): Promise<void> {},
      };
    },
  };
}

describe('NotificationChannelRegistry — 빈 상태 보존', () => {
  it('인스턴스 생성 직후 list()는 빈 배열을 반환한다', () => {
    const registry = new NotificationChannelRegistry();
    expect(registry.list()).toEqual([]);
  });

  it('인스턴스 생성 직후 getById()는 어떤 식별자에 대해서도 undefined를 반환한다', () => {
    const registry = new NotificationChannelRegistry();
    expect(registry.getById('sms')).toBeUndefined();
    expect(registry.getById('push')).toBeUndefined();
    expect(registry.getById('')).toBeUndefined();
  });
});

describe('NotificationChannelRegistry.register — 등록 동작', () => {
  it('등록한 어댑터는 getById로 동일 인스턴스를 반환한다', () => {
    const registry = new NotificationChannelRegistry();
    const sms = makeFakeAdapter('sms');
    registry.register(sms);
    expect(registry.getById('sms')).toBe(sms);
  });

  it('등록한 어댑터는 list()에 등록 순서대로 포함된다', () => {
    const registry = new NotificationChannelRegistry();
    const sms = makeFakeAdapter('sms');
    const push = makeFakeAdapter('push');
    const email = makeFakeAdapter('email');
    registry.register(sms);
    registry.register(push);
    registry.register(email);
    expect(registry.list()).toEqual([sms, push, email]);
  });

  it('schedule 메서드를 가진 어댑터도 동일 인터페이스로 등록·조회된다', () => {
    const registry = new NotificationChannelRegistry();
    const welfare = makeSchedulableAdapter('welfare_check_24h');
    registry.register(welfare);
    const fetched = registry.getById('welfare_check_24h');
    expect(fetched).toBe(welfare);
    expect(typeof fetched?.schedule).toBe('function');
  });

  it('동일 channelId 중복 등록은 거부한다', () => {
    const registry = new NotificationChannelRegistry();
    registry.register(makeFakeAdapter('sms'));
    expect(() => registry.register(makeFakeAdapter('sms'))).toThrow(/duplicate channelId/);
  });

  it('빈 channelId 어댑터는 거부한다', () => {
    const registry = new NotificationChannelRegistry();
    expect(() => registry.register(makeFakeAdapter(''))).toThrow(/non-empty string/);
  });

  it('send가 함수가 아닌 어댑터는 거부한다', () => {
    const registry = new NotificationChannelRegistry();
    const broken = { channelId: 'broken' } as unknown as NotificationChannelAdapter;
    expect(() => registry.register(broken)).toThrow(/send must be a function/);
  });

  it('null/undefined 어댑터는 거부한다', () => {
    const registry = new NotificationChannelRegistry();
    expect(() =>
      registry.register(null as unknown as NotificationChannelAdapter),
    ).toThrow(/null\/undefined/);
    expect(() =>
      registry.register(undefined as unknown as NotificationChannelAdapter),
    ).toThrow(/null\/undefined/);
  });
});

describe('NotificationChannelRegistry.list — 반환 배열 캡슐화', () => {
  it('list() 반환 배열을 변형해도 등록소 내부 상태에는 영향이 없다', () => {
    const registry = new NotificationChannelRegistry();
    registry.register(makeFakeAdapter('sms'));
    const snapshot = registry.list();
    snapshot.length = 0;
    snapshot.push(makeFakeAdapter('push'));
    expect(registry.list().map((a) => a.channelId)).toEqual(['sms']);
    expect(registry.getById('push')).toBeUndefined();
  });

  it('등록 후 list()를 두 번 호출하면 매번 새 배열 인스턴스를 반환한다', () => {
    const registry = new NotificationChannelRegistry();
    registry.register(makeFakeAdapter('sms'));
    const a = registry.list();
    const b = registry.list();
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });
});
