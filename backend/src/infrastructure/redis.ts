// Redis 클라이언트 래퍼와 세션 키/직렬화 헬퍼.
import { Redis, type RedisOptions } from 'ioredis';

export const SESSION_TTL_SECONDS = 60 * 60;

export const SESSION_KEY_PREFIX = 'session:';

export function sessionKey(sessionId: string): string {
  if (typeof sessionId !== 'string' || sessionId.length === 0) {
    throw new Error('sessionKey: sessionId must be a non-empty string');
  }
  if (sessionId.includes(':')) {
    throw new Error(
      `sessionKey: sessionId must not contain ":" (got: ${sessionId})`,
    );
  }
  return `${SESSION_KEY_PREFIX}${sessionId}`;
}

export function serializeJson<T>(value: T): string {
  return JSON.stringify(value);
}

export function deserializeJson<T>(text: string): T {
  return JSON.parse(text) as T;
}

function resolveRedisOptions(): { url?: string; options?: RedisOptions } {
  const url = process.env['REDIS_URL'];
  if (typeof url === 'string' && url.length > 0) {
    return { url };
  }
  const host = process.env['REDIS_HOST'] ?? '127.0.0.1';
  const portStr = process.env['REDIS_PORT'] ?? '6379';
  const port = Number.parseInt(portStr, 10);
  if (!Number.isFinite(port) || port <= 0 || port > 65535) {
    throw new Error(
      `Invalid REDIS_PORT environment variable: ${portStr ?? '(unset)'}`,
    );
  }
  const password = process.env['REDIS_PASSWORD'];
  const dbStr = process.env['REDIS_DB'];
  const db = typeof dbStr === 'string' ? Number.parseInt(dbStr, 10) : 0;
  if (!Number.isFinite(db) || db < 0) {
    throw new Error(`Invalid REDIS_DB environment variable: ${dbStr ?? ''}`);
  }
  const options: RedisOptions = {
    host,
    port,
    db,
    commandTimeout: 5_000,
    maxRetriesPerRequest: 2,
    enableReadyCheck: true,
    lazyConnect: true,
  };
  if (typeof password === 'string' && password.length > 0) {
    options.password = password;
  }
  return { options };
}

let singleton: Redis | undefined;

export function getRedisClient(): Redis {
  if (singleton === undefined) {
    const { url, options } = resolveRedisOptions();
    singleton = url !== undefined ? new Redis(url, options ?? {}) : new Redis(options ?? {});
  }
  return singleton;
}

export function setRedisClientForTesting(client: Redis | undefined): void {
  singleton = client;
}

export async function closeRedisClient(): Promise<void> {
  if (singleton === undefined) return;
  const client = singleton;
  singleton = undefined;
  try {
    await client.quit();
  } catch {
    client.disconnect();
  }
}
