// ConsentRepository 어댑터 — consent_records 테이블 영속화

import type { Pool } from 'pg';

import type {
  ConsentRepository,
  TransactionContext,
} from '../../domain/auth/ports.js';
import type {
  ConsentId,
  ConsentItemKey,
  ConsentItems,
  ConsentRecord,
  UserId,
} from '../../domain/auth/types.js';

import { getQuerier } from './PgTransactionRunner.js';

interface ConsentRow {
  consent_id: string;
  user_id: string;
  privacy_policy: boolean;
  non_medical_disclaimer: boolean;
  guardian_notification: boolean;
  granted_at: Date;
  withdrawn_at: Date | null;
}

export class PgConsentRepository implements ConsentRepository {
  public constructor(private readonly pool: Pool) {}

  public async create(
    record: ConsentRecord,
    tx?: TransactionContext,
  ): Promise<void> {
    const q = getQuerier(this.pool, tx);
    await q.query(
      `INSERT INTO consent_records
         (consent_id, user_id, privacy_policy, non_medical_disclaimer,
          guardian_notification, granted_at, withdrawn_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        record.consentId,
        record.userId,
        record.consentItems.privacyPolicy,
        record.consentItems.nonMedicalDisclaimer,
        record.consentItems.guardianNotification,
        record.grantedAt,
        record.withdrawnAt ?? null,
      ],
    );
  }

  public async findLatestByUserId(
    userId: UserId,
  ): Promise<ConsentRecord | undefined> {
    const result = await this.pool.query<ConsentRow>(
      `SELECT consent_id, user_id, privacy_policy, non_medical_disclaimer,
              guardian_notification, granted_at, withdrawn_at
         FROM consent_records
        WHERE user_id = $1
        ORDER BY granted_at DESC, consent_id DESC
        LIMIT 1`,
      [userId],
    );
    const row = result.rows[0];
    if (row === undefined) {
      return undefined;
    }
    return rowToRecord(row);
  }

  public async withdraw(
    input: {
      consentId: ConsentId;
      userId: UserId;
      items: ConsentItemKey[];
      at: Date;
    },
    tx?: TransactionContext,
  ): Promise<void> {
    const q = getQuerier(this.pool, tx);

    const latest = await q.query<ConsentRow>(
      `SELECT consent_id, user_id, privacy_policy, non_medical_disclaimer,
              guardian_notification, granted_at, withdrawn_at
         FROM consent_records
        WHERE user_id = $1
        ORDER BY granted_at DESC, consent_id DESC
        LIMIT 1`,
      [input.userId],
    );
    const baseItems: ConsentItems =
      latest.rows[0] !== undefined
        ? rowToRecord(latest.rows[0]).consentItems
        : {
            privacyPolicy: false,
            nonMedicalDisclaimer: false,
            guardianNotification: false,
          };

    const nextItems: ConsentItems = { ...baseItems };
    for (const key of input.items) {
      nextItems[key] = false;
    }

    await q.query(
      `INSERT INTO consent_records
         (consent_id, user_id, privacy_policy, non_medical_disclaimer,
          guardian_notification, granted_at, withdrawn_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        input.consentId,
        input.userId,
        nextItems.privacyPolicy,
        nextItems.nonMedicalDisclaimer,
        nextItems.guardianNotification,
        input.at,
        input.at,
      ],
    );
  }
}

function rowToRecord(row: ConsentRow): ConsentRecord {
  const record: ConsentRecord = {
    consentId: row.consent_id,
    userId: row.user_id,
    consentItems: {
      privacyPolicy: row.privacy_policy,
      nonMedicalDisclaimer: row.non_medical_disclaimer,
      guardianNotification: row.guardian_notification,
    },
    grantedAt: row.granted_at,
  };
  if (row.withdrawn_at !== null) {
    record.withdrawnAt = row.withdrawn_at;
  }
  return record;
}
