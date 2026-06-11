// 사용자별 노션 연결(토큰/대상 페이지) 영속화

import type { Pool } from 'pg';

import { encryptSecret, decryptSecret } from './secretCipher.js';

export interface NotionConnection {
  readonly userId: string;
  readonly accessToken: string;
  readonly workspaceName?: string;
  readonly targetPageId?: string;
  readonly targetPageTitle?: string;
}

export interface NotionConnectionRepository {
  get(userId: string): Promise<NotionConnection | undefined>;
  upsert(conn: NotionConnection): Promise<void>;
  delete(userId: string): Promise<void>;
}

export class InMemoryNotionConnectionRepository implements NotionConnectionRepository {
  private readonly store = new Map<string, NotionConnection>();

  public async get(userId: string): Promise<NotionConnection | undefined> {
    return this.store.get(userId);
  }
  public async upsert(conn: NotionConnection): Promise<void> {
    this.store.set(conn.userId, conn);
  }
  public async delete(userId: string): Promise<void> {
    this.store.delete(userId);
  }
}

interface NotionConnectionRow {
  user_id: string;
  access_token: string;
  workspace_name: string | null;
  target_page_id: string | null;
  target_page_title: string | null;
}

export class PgNotionConnectionRepository implements NotionConnectionRepository {
  public constructor(
    private readonly pool: Pool,
    private readonly encKey?: string,
  ) {}

  public async get(userId: string): Promise<NotionConnection | undefined> {
    const result = await this.pool.query<NotionConnectionRow>(
      `SELECT user_id, access_token, workspace_name, target_page_id, target_page_title
         FROM notion_connections WHERE user_id = $1 LIMIT 1`,
      [userId],
    );
    const row = result.rows[0];
    if (row === undefined) return undefined;
    return {
      userId: row.user_id,
      accessToken: decryptSecret(row.access_token, this.encKey),
      ...(row.workspace_name !== null ? { workspaceName: row.workspace_name } : {}),
      ...(row.target_page_id !== null ? { targetPageId: row.target_page_id } : {}),
      ...(row.target_page_title !== null ? { targetPageTitle: row.target_page_title } : {}),
    };
  }

  public async upsert(conn: NotionConnection): Promise<void> {
    const encryptedToken = encryptSecret(conn.accessToken, this.encKey);
    await this.pool.query(
      `INSERT INTO notion_connections
         (user_id, access_token, workspace_name, target_page_id, target_page_title, updated_at)
       VALUES ($1, $2, $3, $4, $5, now())
       ON CONFLICT (user_id) DO UPDATE SET
         access_token      = EXCLUDED.access_token,
         workspace_name    = EXCLUDED.workspace_name,
         target_page_id    = EXCLUDED.target_page_id,
         target_page_title = EXCLUDED.target_page_title,
         updated_at        = now()`,
      [
        conn.userId,
        encryptedToken,
        conn.workspaceName ?? null,
        conn.targetPageId ?? null,
        conn.targetPageTitle ?? null,
      ],
    );
  }

  public async delete(userId: string): Promise<void> {
    await this.pool.query('DELETE FROM notion_connections WHERE user_id = $1', [userId]);
  }
}
