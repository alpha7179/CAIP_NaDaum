// pg.Pool / pg.PoolClient 테스트 전용 페이크

import type { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';

export interface RecordedQuery {
  text: string;
  params: unknown[];
}

export type QueryHandler = (
  text: string,
  params: unknown[],
) => { rows: ReadonlyArray<QueryResultRow>; rowCount: number };

export interface FakePoolOptions {
  handler?: QueryHandler;
}

export interface FakePool {
  pool: Pool;
  recorded: RecordedQuery[];
  clients: FakeClient[];
}

export interface FakeClient {
  client: PoolClient;
  recorded: RecordedQuery[];
  released: boolean;
}

export function createFakePool(options: FakePoolOptions = {}): FakePool {
  const recorded: RecordedQuery[] = [];
  const clients: FakeClient[] = [];
  const handler: QueryHandler = options.handler ?? (() => ({ rows: [], rowCount: 0 }));

  const poolLike = {
    async query<R extends QueryResultRow = QueryResultRow>(
      text: string,
      params?: ReadonlyArray<unknown>,
    ): Promise<QueryResult<R>> {
      const p = params ? [...params] : [];
      recorded.push({ text, params: p });
      const result = handler(text, p);
      return {
        command: '',
        rowCount: result.rowCount,
        oid: 0,
        fields: [],
        rows: result.rows as unknown as R[],
      } as unknown as QueryResult<R>;
    },
    async connect(): Promise<PoolClient> {
      const fake = makeFakeClient(handler);
      clients.push(fake);
      return fake.client;
    },
  };

  return {
    pool: poolLike as unknown as Pool,
    recorded,
    clients,
  };
}

function makeFakeClient(handler: QueryHandler): FakeClient {
  const recorded: RecordedQuery[] = [];
  const state = { released: false };
  const clientLike = {
    async query<R extends QueryResultRow = QueryResultRow>(
      text: string,
      params?: ReadonlyArray<unknown>,
    ): Promise<QueryResult<R>> {
      const p = params ? [...params] : [];
      recorded.push({ text, params: p });
      const result = handler(text, p);
      return {
        command: '',
        rowCount: result.rowCount,
        oid: 0,
        fields: [],
        rows: result.rows as unknown as R[],
      } as unknown as QueryResult<R>;
    },
    release(): void {
      state.released = true;
    },
  };
  const fake: FakeClient = {
    client: clientLike as unknown as PoolClient,
    recorded,
    get released(): boolean {
      return state.released;
    },
    set released(_v: boolean) {
      state.released = _v;
    },
  };
  return fake;
}
