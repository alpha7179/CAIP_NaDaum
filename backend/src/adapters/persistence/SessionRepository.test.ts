// RedisSessionRepository / InMemorySessionRepository 어댑터 테스트
import type { SessionContext } from '@nadaum/shared';
import { describe, expect, it } from 'vitest';


import { createInitialSessionContext } from '../../domain/session/SessionContext.js';
import { SESSION_TTL_SECONDS } from '../../infrastructure/redis.js';

import {
  InMemorySessionRepository,
  RedisSessionRepository,
  type SessionRedisClient,
} from './SessionRepository.js';

function fakeRedis(): SessionRedisClient & {
  store: Map<string, string>;
  calls: Array<{ op: string; key: string; ttl?: number }>;
} {
  const store = new Map<string, string>();
  const calls: Array<{ op: string; key: string; ttl?: number }> = [];
  return {
    store,
    calls,
    async get(key: string): Promise<string | null> {
      calls.push({ op: 'get', key });
      return store.get(key) ?? null;
    },
    async set(key: string, value: string, _mode: 'EX', ttl: number): Promise<unknown> {
      calls.push({ op: 'set', key, ttl });
      store.set(key, value);
      return 'OK';
    },
    async del(key: string): Promise<unknown> {
      calls.push({ op: 'del', key });
      store.delete(key);
      return 1;
    },
  };
}

function sampleContext(): SessionContext {
  return createInitialSessionContext({
    sessionId: 'abc',
    userId: 'user-1',
    startedAt: new Date('2026-05-28T00:00:00.000Z'),
  });
}

describe('RedisSessionRepository', () => {
  it('saves under session:{id} with a 1-hour TTL', async () => {
    const redis = fakeRedis();
    const repo = new RedisSessionRepository(redis);
    await repo.saveSession(sampleContext());
    const setCall = redis.calls.find((c) => c.op === 'set');
    expect(setCall?.key).toBe('session:abc');
    expect(setCall?.ttl).toBe(SESSION_TTL_SECONDS);
  });

  it('round-trips a session through serialize/deserialize with restored Date', async () => {
    const redis = fakeRedis();
    const repo = new RedisSessionRepository(redis);
    await repo.saveSession(sampleContext());
    const loaded = await repo.getSession('abc');
    expect(loaded?.sessionId).toBe('abc');
    expect(loaded?.startedAt).toBeInstanceOf(Date);
    expect(loaded?.startedAt.toISOString()).toBe('2026-05-28T00:00:00.000Z');
    expect(loaded?.stage).toBe('상황파악');
  });

  it('returns undefined for a missing session', async () => {
    const repo = new RedisSessionRepository(fakeRedis());
    expect(await repo.getSession('missing')).toBeUndefined();
  });

  it('deletes a session key', async () => {
    const redis = fakeRedis();
    const repo = new RedisSessionRepository(redis);
    await repo.saveSession(sampleContext());
    await repo.deleteSession('abc');
    expect(redis.store.has('session:abc')).toBe(false);
  });
});

describe('InMemorySessionRepository', () => {
  it('round-trips and deletes', async () => {
    const repo = new InMemorySessionRepository();
    await repo.saveSession(sampleContext());
    expect((await repo.getSession('abc'))?.userId).toBe('user-1');
    await repo.deleteSession('abc');
    expect(await repo.getSession('abc')).toBeUndefined();
  });
});
