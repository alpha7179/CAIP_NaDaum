// ArtifactConsentRepository 어댑터 — artifact_consents 테이블 영속화

import { randomUUID } from 'node:crypto';

import type { Pool, PoolClient } from 'pg';

import type {
  ArtifactConsentRecord,
  ArtifactConsentRepository,
  ConsentSnapshot,
} from '../../domain/artifact/ArtifactConsentRepository.js';

interface ConsentRow {
  consent_id: string;
  user_id: string;
  artifact_type: string;
  granted: boolean;
  granted_at: Date;
  withdrawn_at: Date | null;
}

export class PgArtifactConsentRepository implements ArtifactConsentRepository {
  constructor(private readonly pool: Pool) {}

  async grant(userId: string, artifactType: string, at: Date = new Date()): Promise<void> {
    await this.withTx(async (client) => {
      const existing = await selectExistingForUpdate(client, userId, artifactType);
      if (existing === undefined) {
        await client.query(
          `INSERT INTO artifact_consents
             (consent_id, user_id, artifact_type, granted, granted_at, withdrawn_at)
           VALUES ($1, $2, $3, TRUE, $4, NULL)`,
          [randomUUID(), userId, artifactType, at],
        );
        return;
      }
      await client.query(
        `UPDATE artifact_consents
           SET granted = TRUE,
               granted_at = $1,
               withdrawn_at = NULL
         WHERE consent_id = $2`,
        [at, existing.consent_id],
      );
    });
  }

  async revoke(userId: string, artifactType: string, at: Date = new Date()): Promise<void> {
    await this.withTx(async (client) => {
      const existing = await selectExistingForUpdate(client, userId, artifactType);
      if (existing === undefined) {
        return;
      }
      await client.query(
        `UPDATE artifact_consents
           SET granted = FALSE,
               withdrawn_at = $1
         WHERE consent_id = $2`,
        [at, existing.consent_id],
      );
    });
  }

  async findByUser(userId: string): Promise<ArtifactConsentRecord[]> {
    const result = await this.pool.query<ConsentRow>(
      `SELECT consent_id, user_id, artifact_type, granted, granted_at, withdrawn_at
         FROM artifact_consents
        WHERE user_id = $1
        ORDER BY artifact_type ASC`,
      [userId],
    );
    return result.rows.map(rowToRecord);
  }

  async getSnapshot(userId: string): Promise<ConsentSnapshot> {
    const records = await this.findByUser(userId);
    return recordsToSnapshot(userId, records);
  }

  private async withTx<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await work(client);
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

async function selectExistingForUpdate(
  client: PoolClient,
  userId: string,
  artifactType: string,
): Promise<ConsentRow | undefined> {
  const result = await client.query<ConsentRow>(
    `SELECT consent_id, user_id, artifact_type, granted, granted_at, withdrawn_at
       FROM artifact_consents
      WHERE user_id = $1 AND artifact_type = $2
      ORDER BY granted_at DESC
      LIMIT 1
      FOR UPDATE`,
    [userId, artifactType],
  );
  return result.rows[0];
}

function rowToRecord(row: ConsentRow): ArtifactConsentRecord {
  const record: ArtifactConsentRecord = {
    userId: row.user_id,
    artifactType: row.artifact_type,
    granted: row.granted,
    grantedAt: row.granted_at,
  };
  if (row.withdrawn_at !== null) {
    record.revokedAt = row.withdrawn_at;
  }
  return record;
}

// 도메인 단위 테스트용 인메모리 ArtifactConsentRepository
export class InMemoryArtifactConsentRepository implements ArtifactConsentRepository {
  private readonly records = new Map<string, ArtifactConsentRecord>();

  async grant(userId: string, artifactType: string, at: Date = new Date()): Promise<void> {
    const key = makeKey(userId, artifactType);
    this.records.set(key, {
      userId,
      artifactType,
      granted: true,
      grantedAt: at,
    });
  }

  async revoke(userId: string, artifactType: string, at: Date = new Date()): Promise<void> {
    const key = makeKey(userId, artifactType);
    const existing = this.records.get(key);
    if (existing === undefined) {
      return;
    }
    this.records.set(key, {
      userId,
      artifactType,
      granted: false,
      grantedAt: existing.grantedAt,
      revokedAt: at,
    });
  }

  async findByUser(userId: string): Promise<ArtifactConsentRecord[]> {
    const list: ArtifactConsentRecord[] = [];
    for (const record of this.records.values()) {
      if (record.userId === userId) {
        list.push(cloneRecord(record));
      }
    }
    list.sort((a, b) => (a.artifactType < b.artifactType ? -1 : a.artifactType > b.artifactType ? 1 : 0));
    return list;
  }

  async getSnapshot(userId: string): Promise<ConsentSnapshot> {
    const records = await this.findByUser(userId);
    return recordsToSnapshot(userId, records);
  }
}

function makeKey(userId: string, artifactType: string): string {
  return `${userId}\u0000${artifactType}`;
}

function cloneRecord(record: ArtifactConsentRecord): ArtifactConsentRecord {
  const clone: ArtifactConsentRecord = {
    userId: record.userId,
    artifactType: record.artifactType,
    granted: record.granted,
    grantedAt: record.grantedAt,
  };
  if (record.revokedAt !== undefined) {
    clone.revokedAt = record.revokedAt;
  }
  return clone;
}

function recordsToSnapshot(
  userId: string,
  records: ReadonlyArray<ArtifactConsentRecord>,
): ConsentSnapshot {
  const granted: Record<string, boolean> = {};
  for (const record of records) {
    granted[record.artifactType] = record.granted;
  }
  return { userId, granted };
}
