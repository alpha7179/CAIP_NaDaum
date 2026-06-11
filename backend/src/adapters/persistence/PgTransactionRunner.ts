// PostgreSQL 트랜잭션 러너 어댑터

import type { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';

import type {
  TransactionContext,
  TransactionRunner,
} from '../../domain/auth/ports.js';

export interface Querier {
  query<R extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: ReadonlyArray<unknown>,
  ): Promise<QueryResult<R>>;
}

export class PgTransactionContext implements TransactionContext {
  public readonly _brand = 'transaction-context' as const;

  public constructor(public readonly client: PoolClient) {}
}

export function getQuerier(pool: Pool, tx?: TransactionContext): Querier {
  if (tx === undefined) {
    return pool;
  }
  if (tx instanceof PgTransactionContext) {
    return tx.client;
  }
  throw new TypeError(
    'getQuerier: unknown TransactionContext implementation; expected PgTransactionContext',
  );
}

export class PgTransactionRunner implements TransactionRunner {
  public constructor(private readonly pool: Pool) {}

  public async run<T>(work: (tx: TransactionContext) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    const ctx = new PgTransactionContext(client);
    try {
      await client.query('BEGIN');
      const result = await work(ctx);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }
}
