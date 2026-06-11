// SessionRepository 어댑터 — Redis 기반 활성 세션 상태 영속화

import type { SessionContext } from '@nadaum/shared';

import {
  deserializeSessionContext,
  stringifySessionContext,
} from '../../domain/session/SessionContext.js';
import type { SessionRepository } from '../../domain/session/SessionRepository.js';
import { SESSION_TTL_SECONDS, sessionKey } from '../../infrastructure/redis.js';

export interface SessionRedisClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode: 'EX', ttlSeconds: number): Promise<unknown>;
  del(key: string): Promise<unknown>;
}

export class RedisSessionRepository implements SessionRepository {
  public constructor(
    private readonly client: SessionRedisClient,
    private readonly ttlSeconds: number = SESSION_TTL_SECONDS,
  ) {}

  public async getSession(sessionId: string): Promise<SessionContext | undefined> {
    const raw = await this.client.get(sessionKey(sessionId));
    if (raw === null) {
      return undefined;
    }
    return deserializeSessionContext(raw);
  }

  public async saveSession(context: SessionContext): Promise<void> {
    await this.client.set(
      sessionKey(context.sessionId),
      stringifySessionContext(context),
      'EX',
      this.ttlSeconds,
    );
  }

  public async deleteSession(sessionId: string): Promise<void> {
    await this.client.del(sessionKey(sessionId));
  }
}

export class InMemorySessionRepository implements SessionRepository {
  private readonly store = new Map<string, string>();

  public async getSession(sessionId: string): Promise<SessionContext | undefined> {
    const raw = this.store.get(sessionId);
    if (raw === undefined) {
      return undefined;
    }
    return deserializeSessionContext(raw);
  }

  public async saveSession(context: SessionContext): Promise<void> {
    this.store.set(context.sessionId, stringifySessionContext(context));
  }

  public async deleteSession(sessionId: string): Promise<void> {
    this.store.delete(sessionId);
  }
}
