// GuardianRepository 어댑터 — guardian_contacts 테이블 영속화

import type { Pool } from 'pg';

import type {
  GuardianRepository,
  TransactionContext,
} from '../../domain/auth/ports.js';
import type { GuardianContact, UserId } from '../../domain/auth/types.js';

import { getQuerier } from './PgTransactionRunner.js';

interface GuardianRow {
  guardian_id: string;
  user_id: string;
  relationship: string | null;
  name: string;
  email: string;
  phone: string | null;
  email_enabled: boolean;
  sms_enabled: boolean;
  created_at: Date;
}

function buildInsert(contacts: GuardianContact[]): { text: string; params: unknown[] } {
  const COLUMNS_PER_ROW = 9;
  const valueGroups: string[] = [];
  const params: unknown[] = [];
  contacts.forEach((g, idx) => {
    const base = idx * COLUMNS_PER_ROW;
    const ph = Array.from({ length: COLUMNS_PER_ROW }, (_, k) => `$${base + k + 1}`).join(', ');
    valueGroups.push(`(${ph})`);
    params.push(
      g.guardianId,
      g.userId,
      g.relationship ?? null,
      g.name,
      g.email,
      g.phone,
      g.emailEnabled,
      g.smsEnabled,
      g.createdAt,
    );
  });
  return {
    text: `INSERT INTO guardian_contacts
         (guardian_id, user_id, relationship, name, email, phone, email_enabled, sms_enabled, created_at)
       VALUES ${valueGroups.join(', ')}`,
    params,
  };
}

export class PgGuardianRepository implements GuardianRepository {
  public constructor(private readonly pool: Pool) {}

  public async createMany(
    contacts: GuardianContact[],
    tx?: TransactionContext,
  ): Promise<void> {
    if (contacts.length === 0) {
      return;
    }
    const q = getQuerier(this.pool, tx);
    const { text, params } = buildInsert(contacts);
    await q.query(text, params);
  }

  public async replaceAll(
    userId: UserId,
    contacts: GuardianContact[],
    tx?: TransactionContext,
  ): Promise<void> {
    if (tx !== undefined) {
      const q = getQuerier(this.pool, tx);
      await q.query('DELETE FROM guardian_contacts WHERE user_id = $1', [userId]);
      if (contacts.length > 0) {
        const { text, params } = buildInsert(contacts);
        await q.query(text, params);
      }
      return;
    }
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM guardian_contacts WHERE user_id = $1', [userId]);
      if (contacts.length > 0) {
        const { text, params } = buildInsert(contacts);
        await client.query(text, params);
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  public async listByUserId(userId: UserId): Promise<GuardianContact[]> {
    const result = await this.pool.query<GuardianRow>(
      `SELECT guardian_id, user_id, relationship, name, email, phone, email_enabled, sms_enabled, created_at
         FROM guardian_contacts
        WHERE user_id = $1
        ORDER BY created_at ASC, guardian_id ASC`,
      [userId],
    );
    return result.rows.map(rowToContact);
  }
}

function rowToContact(row: GuardianRow): GuardianContact {
  return {
    guardianId: row.guardian_id,
    userId: row.user_id,
    ...(row.relationship !== null && row.relationship.length > 0 ? { relationship: row.relationship } : {}),
    name: row.name,
    email: row.email,
    phone: row.phone ?? '',
    emailEnabled: row.email_enabled,
    smsEnabled: row.sms_enabled,
    createdAt: row.created_at,
  };
}
