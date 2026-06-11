// PgUserRepository 단위 테스트

import { describe, it, expect } from 'vitest';

import { PgTransactionContext } from './PgTransactionRunner.js';
import { PgUserRepository } from './PgUserRepository.js';
import {
  createFakePool,
  type RecordedQuery,
} from './__fakes__/fake-pool.js';

describe('PgUserRepository.create', () => {
  it('inserts a user row with bound parameters in column order', async () => {
    const { pool, recorded } = createFakePool();
    const repo = new PgUserRepository(pool);
    const at = new Date('2025-01-15T03:04:05.000Z');

    await repo.create({
      userId: 'u-1',
      email: 'kim@example.com',
      passwordHash: 'hash',
      name: '김다움',
      createdAt: at,
    });

    expect(recorded).toHaveLength(1);
    const q = recorded[0] as RecordedQuery;
    expect(q.text).toMatch(/INSERT INTO users/);
    expect(q.text).toMatch(/user_id, email, password_hash, name, created_at/);
    expect(q.params).toEqual(['u-1', 'kim@example.com', 'hash', '김다움', at]);
  });

  it('binds name as null when omitted', async () => {
    const { pool, recorded } = createFakePool();
    const repo = new PgUserRepository(pool);
    const at = new Date('2025-01-15T03:04:05.000Z');

    await repo.create({
      userId: 'u-1',
      email: 'kim@example.com',
      passwordHash: 'hash',
      createdAt: at,
    });

    const q = recorded[0] as RecordedQuery;
    expect(q.params).toEqual(['u-1', 'kim@example.com', 'hash', null, at]);
  });

  it('uses the transaction client when a TransactionContext is provided', async () => {
    const { pool, recorded: poolRecorded } = createFakePool();
    const { client, recorded: clientRecorded } = makeFakeClient();
    const repo = new PgUserRepository(pool);
    const at = new Date('2025-02-01T00:00:00.000Z');

    await repo.create(
      {
        userId: 'u-2',
        email: 'lee@example.com',
        passwordHash: 'h',
        createdAt: at,
      },
      new PgTransactionContext(client),
    );

    expect(poolRecorded).toHaveLength(0);
    expect(clientRecorded).toHaveLength(1);
    expect((clientRecorded[0] as RecordedQuery).text).toMatch(/INSERT INTO users/);
  });
});

describe('PgUserRepository.existsById', () => {
  it('returns true when row exists', async () => {
    const { pool } = createFakePool({
      handler: () => ({ rows: [{ exists: true }], rowCount: 1 }),
    });
    const repo = new PgUserRepository(pool);
    expect(await repo.existsById('u-1')).toBe(true);
  });

  it('returns false when no row matches', async () => {
    const { pool } = createFakePool({
      handler: () => ({ rows: [{ exists: false }], rowCount: 1 }),
    });
    const repo = new PgUserRepository(pool);
    expect(await repo.existsById('u-missing')).toBe(false);
  });
});

function makeFakeClient(): {
  client: import('pg').PoolClient;
  recorded: RecordedQuery[];
} {
  const recorded: RecordedQuery[] = [];
  const client = {
    query: async (text: string, params?: ReadonlyArray<unknown>) => {
      recorded.push({ text, params: params ? [...params] : [] });
      return { rows: [], rowCount: 0 };
    },
    release: () => undefined,
  } as unknown as import('pg').PoolClient;
  return { client, recorded };
}
