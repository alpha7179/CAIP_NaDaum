// PgTransactionRunner 단위 테스트

import { describe, it, expect } from 'vitest';

import { PgTransactionRunner, getQuerier, PgTransactionContext } from './PgTransactionRunner.js';
import { createFakePool } from './__fakes__/fake-pool.js';

describe('PgTransactionRunner.run', () => {
  it('runs BEGIN, the work callback, then COMMIT, and releases the client', async () => {
    const { pool, clients } = createFakePool();
    const runner = new PgTransactionRunner(pool);

    const result = await runner.run(async (tx) => {
      const q = getQuerier(pool, tx);
      await q.query('SELECT 1', []);
      return 42;
    });

    expect(result).toBe(42);
    expect(clients).toHaveLength(1);
    const sequence = clients[0]!.recorded.map((r) => r.text);
    expect(sequence).toEqual(['BEGIN', 'SELECT 1', 'COMMIT']);
    expect(clients[0]!.released).toBe(true);
  });

  it('rolls back and rethrows the original error when the callback throws', async () => {
    const { pool, clients } = createFakePool();
    const runner = new PgTransactionRunner(pool);

    await expect(
      runner.run(async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    expect(clients).toHaveLength(1);
    const sequence = clients[0]!.recorded.map((r) => r.text);
    expect(sequence).toEqual(['BEGIN', 'ROLLBACK']);
    expect(clients[0]!.released).toBe(true);
  });

  it('releases the client even if ROLLBACK itself fails (swallow)', async () => {
    const connectCount = 0;
    const { pool, clients } = createFakePool({
      handler: (text) => {
        if (text === 'ROLLBACK') {
          throw new Error('rollback-failed');
        }
        return { rows: [], rowCount: 0 };
      },
    });
    void connectCount;
    const runner = new PgTransactionRunner(pool);

    await expect(
      runner.run(async () => {
        throw new Error('original');
      }),
    ).rejects.toThrow('original');

    expect(clients[0]!.released).toBe(true);
  });
});

describe('getQuerier', () => {
  it('returns the pool when no transaction context is provided', () => {
    const { pool } = createFakePool();
    expect(getQuerier(pool)).toBe(pool);
  });

  it('returns the transaction client when PgTransactionContext is provided', async () => {
    const { pool, clients } = createFakePool();
    const runner = new PgTransactionRunner(pool);
    await runner.run(async (tx) => {
      expect(tx).toBeInstanceOf(PgTransactionContext);
      const q = getQuerier(pool, tx);
      await q.query('SELECT 2', []);
    });
    const texts = clients[0]!.recorded.map((r) => r.text);
    expect(texts).toContain('SELECT 2');
  });

  it('throws TypeError on unknown TransactionContext implementations', () => {
    const { pool } = createFakePool();
    const stranger = { _brand: 'transaction-context' } as unknown as Parameters<
      typeof getQuerier
    >[1];
    expect(() => getQuerier(pool, stranger)).toThrow(TypeError);
  });
});
