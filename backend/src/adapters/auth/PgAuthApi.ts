// PgAuthApi — 프로덕션 인증·동의 API 어댑터 (트랜스포트 AuthApi 구현)

import { randomUUID } from 'node:crypto';

import type { Pool } from 'pg';

import type { AuthService } from '../../domain/auth/AuthService.js';
import { AuthValidationError, WITHDRAWABLE_CONSENT_ITEM_KEYS, type ConsentItemKey } from '../../domain/auth/types.js';
import type { AuthApi } from '../../transport/ports.js';
import { signJwt } from '../../transport/security/jwt.js';

import { hashPassword, verifyPassword } from './password.js';

const TOKEN_TTL_SEC = 60 * 60 * 24;

interface UserRow {
  user_id: string;
  password_hash: string;
  is_admin: boolean;
  name: string | null;
}

interface EmailExistsRow {
  exists: boolean;
}

export function createPgAuthApi(pool: Pool, authService: AuthService, jwtSecret: string): AuthApi {
  const issue = (userId: string, isAdmin = false): string =>
    signJwt({ sub: userId, ...(isAdmin ? { admin: true } : {}) }, jwtSecret, { expiresInSec: TOKEN_TTL_SEC });

  return {
    async register(body) {
      const passwordHash = await hashPassword(body.password);
      try {
        const { userId } = await authService.registerUser({
          email: body.email,
          passwordHash,
          ...(body.name !== undefined ? { name: body.name } : {}),
          consentItems: {
            privacyPolicy: body.consentItems.privacyPolicy,
            nonMedicalDisclaimer: body.consentItems.nonMedicalDisclaimer,
            guardianNotification: body.consentItems.guardianNotification ?? false,
          },
          guardians: body.guardians
            ? body.guardians.map((g) => ({ name: g.name, email: g.email, phone: g.phone }))
            : [],
        });
        return { userId, token: issue(userId), ...(body.name !== undefined ? { name: body.name } : {}) };
      } catch (err) {
        if (typeof err === 'object' && err !== null && (err as { code?: string }).code === '23505') {
          throw new AuthValidationError('email_taken', '이미 가입된 이메일입니다.');
        }
        throw err;
      }
    },

    async login(body) {
      const res = await pool.query<UserRow>(
        'SELECT user_id, password_hash, is_admin, name FROM users WHERE email = $1 LIMIT 1',
        [body.email],
      );
      const row = res.rows[0];
      if (row === undefined) return undefined;
      const ok = await verifyPassword(body.password, row.password_hash);
      return ok
        ? {
            userId: row.user_id,
            token: issue(row.user_id, row.is_admin),
            isAdmin: row.is_admin,
            ...(row.name !== null ? { name: row.name } : {}),
          }
        : undefined;
    },

    async isEmailAvailable(email) {
      const res = await pool.query<EmailExistsRow>(
        'SELECT EXISTS(SELECT 1 FROM users WHERE email = $1) AS exists',
        [email],
      );
      return res.rows[0]?.exists !== true;
    },

    async loginWithGoogle(_googleId, email, name, photoUrl) {
      const found = await pool.query<{ user_id: string; is_admin: boolean; name: string | null }>(
        'SELECT user_id, is_admin, name FROM users WHERE email = $1 LIMIT 1',
        [email],
      );
      let row = found.rows[0];
      let userId = row?.user_id;
      if (userId === undefined) {
        userId = randomUUID();
        await pool.query(
          'INSERT INTO users (user_id, email, password_hash, name, photo_url, created_at) VALUES ($1, $2, $3, $4, $5, now())',
          [userId, email, '', name ?? null, photoUrl ?? null],
        );
        row = { user_id: userId, is_admin: false, name: name ?? null };
      } else if (photoUrl !== undefined && photoUrl.length > 0) {
        await pool.query('UPDATE users SET photo_url = $2 WHERE user_id = $1', [userId, photoUrl]);
      }
      const isAdmin = row?.is_admin === true;
      const resolvedName = row?.name !== null && row?.name !== undefined ? row.name : name;
      return {
        userId,
        token: issue(userId, isAdmin),
        isAdmin,
        ...(resolvedName ? { name: resolvedName } : {}),
      };
    },

    async changePassword(userId, currentPassword, newPassword) {
      const res = await pool.query<UserRow>(
        'SELECT user_id, password_hash FROM users WHERE user_id = $1 LIMIT 1',
        [userId],
      );
      const row = res.rows[0];
      if (row === undefined) return false;
      const ok = await verifyPassword(currentPassword, row.password_hash);
      if (!ok) return false;
      const newHash = await hashPassword(newPassword);
      await pool.query('UPDATE users SET password_hash = $2 WHERE user_id = $1', [userId, newHash]);
      return true;
    },

    async withdrawConsent(userId, items) {
      const known = new Set<string>(WITHDRAWABLE_CONSENT_ITEM_KEYS);
      const keys = items.filter((i): i is ConsentItemKey => known.has(i));
      await authService.withdrawConsent(userId, keys);
    },

    async getNotificationPreferences(userId) {
      const res = await pool.query<{ alert_email_enabled: boolean; alert_sms_enabled: boolean }>(
        'SELECT alert_email_enabled, alert_sms_enabled FROM users WHERE user_id = $1 LIMIT 1',
        [userId],
      );
      const row = res.rows[0];
      return {
        emailEnabled: row?.alert_email_enabled ?? true,
        smsEnabled: row?.alert_sms_enabled ?? true,
      };
    },

    async setNotificationPreferences(userId, prefs) {
      await pool.query(
        `UPDATE users
            SET alert_email_enabled = COALESCE($2, alert_email_enabled),
                alert_sms_enabled   = COALESCE($3, alert_sms_enabled)
          WHERE user_id = $1`,
        [userId, prefs.emailEnabled ?? null, prefs.smsEnabled ?? null],
      );
    },

    async getGuardians(userId) {
      const list = await authService.listGuardians(userId);
      return list.map((g) => ({
        ...(g.relationship !== undefined ? { relationship: g.relationship } : {}),
        name: g.name,
        email: g.email,
        phone: g.phone,
        emailEnabled: g.emailEnabled,
        smsEnabled: g.smsEnabled,
      }));
    },

    async setGuardians(userId, guardians) {
      await authService.replaceGuardians(
        userId,
        guardians.map((g) => ({
          ...(g.relationship !== undefined ? { relationship: g.relationship } : {}),
          name: g.name,
          email: g.email,
          phone: g.phone,
          emailEnabled: g.emailEnabled,
          smsEnabled: g.smsEnabled,
        })),
      );
    },

    async deleteAccount(userId) {
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
  };
}
