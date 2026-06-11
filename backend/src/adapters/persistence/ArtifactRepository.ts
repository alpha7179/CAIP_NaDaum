// ArtifactRepository 어댑터 — artifacts 메타 테이블 영속화

import type { Pool } from 'pg';

import type { AccessPolicy } from '../../domain/artifact/ArtifactProducer.js';
import type { TransactionContext } from '../../domain/auth/ports.js';
import type { ArtifactMeta, ArtifactRepository } from '../../domain/diary/ports.js';

import { getQuerier } from './PgTransactionRunner.js';

interface ArtifactRow {
  artifact_id: string;
  artifact_type: string;
  user_id: string;
  session_id: string;
  recipients: string[] | null;
  access_policy: AccessPolicy;
  payload_ref: string;
  created_at: Date;
}

function rowToMeta(row: ArtifactRow): ArtifactMeta {
  const meta: ArtifactMeta = {
    artifactId: row.artifact_id,
    artifactType: row.artifact_type,
    userId: row.user_id,
    sessionId: row.session_id,
    accessPolicy: row.access_policy,
    payloadRef: row.payload_ref,
    createdAt: row.created_at,
  };
  if (row.recipients !== null) {
    return { ...meta, recipients: row.recipients };
  }
  return meta;
}

export class PgArtifactRepository implements ArtifactRepository {
  public constructor(private readonly pool: Pool) {}

  public async insert(meta: ArtifactMeta, tx?: TransactionContext): Promise<void> {
    const q = getQuerier(this.pool, tx);
    await q.query(
      `INSERT INTO artifacts
         (artifact_id, artifact_type, user_id, session_id, recipients, access_policy, payload_ref, created_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8)`,
      [
        meta.artifactId,
        meta.artifactType,
        meta.userId,
        meta.sessionId,
        meta.recipients !== undefined ? JSON.stringify(meta.recipients) : null,
        JSON.stringify(meta.accessPolicy),
        meta.payloadRef,
        meta.createdAt,
      ],
    );
  }

  public async findById(artifactId: string): Promise<ArtifactMeta | undefined> {
    const result = await this.pool.query<ArtifactRow>(
      `SELECT artifact_id, artifact_type, user_id, session_id, recipients,
              access_policy, payload_ref, created_at
         FROM artifacts WHERE artifact_id = $1 LIMIT 1`,
      [artifactId],
    );
    const row = result.rows[0];
    return row === undefined ? undefined : rowToMeta(row);
  }
}

export class InMemoryArtifactRepository implements ArtifactRepository {
  private readonly store: ArtifactMeta[] = [];

  public async insert(meta: ArtifactMeta): Promise<void> {
    this.store.push({ ...meta });
  }

  public async findById(artifactId: string): Promise<ArtifactMeta | undefined> {
    return this.store.find((m) => m.artifactId === artifactId);
  }

  public list(): ArtifactMeta[] {
    return this.store.slice();
  }
}
