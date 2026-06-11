// PgAdminApi — 관리자 사용자 관리 API 어댑터

import type { Pool } from 'pg';

import type { DiaryQueryService } from '../../domain/query/DiaryQueryService.js';
import type { AdminApi, UserSummary } from '../../transport/ports.js';

import { ProtectedAdminError, isProtectedAdminEmail } from './adminProtection.js';

interface UserRow {
  user_id: string;
  email: string;
  name: string | null;
  is_admin: boolean;
  created_at: string;
  assigned_model: string | null;
  photo_url: string | null;
}

export function createPgAdminApi(pool: Pool, diaries: DiaryQueryService): AdminApi {
  return {
    async listUsers() {
      const res = await pool.query<UserRow>(
        'SELECT user_id, email, name, is_admin, created_at, assigned_model, photo_url FROM users ORDER BY created_at DESC',
      );
      return res.rows.map<UserSummary>((r) => ({
        userId: r.user_id,
        email: r.email,
        ...(r.name !== null ? { name: r.name } : {}),
        isAdmin: r.is_admin,
        createdAt: typeof r.created_at === 'string' ? r.created_at : new Date(r.created_at).toISOString(),
        ...(r.assigned_model !== null ? { assignedModel: r.assigned_model } : {}),
        ...(r.photo_url !== null ? { photoUrl: r.photo_url } : {}),
      }));
    },

    async deleteUser(userId) {
      const target = await pool.query<{ email: string }>(
        'SELECT email FROM users WHERE user_id = $1 LIMIT 1',
        [userId],
      );
      if (target.rows.length > 0 && isProtectedAdminEmail(target.rows[0]!.email)) {
        throw new ProtectedAdminError();
      }
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('DELETE FROM safety_audit_log WHERE user_id = $1', [userId]);
        await client.query('DELETE FROM users WHERE user_id = $1', [userId]);
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    },

    async setAdmin(userId, isAdmin) {
      if (!isAdmin) {
        const target = await pool.query<{ email: string }>(
          'SELECT email FROM users WHERE user_id = $1 LIMIT 1',
          [userId],
        );
        if (target.rows.length > 0 && isProtectedAdminEmail(target.rows[0]!.email)) {
          throw new ProtectedAdminError();
        }
      }
      await pool.query('UPDATE users SET is_admin = $2 WHERE user_id = $1', [userId, isAdmin]);
    },

    async getUserDiaries(userId, page) {
      const result = await diaries.list(userId, page);
      return { items: result.items, hasNext: result.hasNext };
    },

    async setUserModel(userId, modelId) {
      await pool.query(
        'UPDATE users SET assigned_model = $2 WHERE user_id = $1',
        [userId, modelId ?? null],
      );
    },

    async getUserModel(userId) {
      const res = await pool.query<{ assigned_model: string | null }>(
        'SELECT assigned_model FROM users WHERE user_id = $1 LIMIT 1',
        [userId],
      );
      const m = res.rows[0]?.assigned_model;
      return m !== null && m !== undefined && m.length > 0 ? m : undefined;
    },
  };
}
