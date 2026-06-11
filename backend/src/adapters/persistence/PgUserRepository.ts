// PgUserRepository — users 테이블 영속화 어댑터

import type { Pool } from 'pg';

import type {
  TransactionContext,
  UserRepository,
} from '../../domain/auth/ports.js';
import type { UserId } from '../../domain/auth/types.js';

import { getQuerier } from './PgTransactionRunner.js';

interface UserExistsRow {
  exists: boolean;
}

export class PgUserRepository implements UserRepository {
  public constructor(private readonly pool: Pool) {}

  public async create(
    input: {
      userId: UserId;
      email: string;
      passwordHash: string;
      name?: string;
      createdAt: Date;
    },
    tx?: TransactionContext,
  ): Promise<void> {
    const q = getQuerier(this.pool, tx);
    await q.query(
      `INSERT INTO users (user_id, email, password_hash, name, created_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [input.userId, input.email, input.passwordHash, input.name ?? null, input.createdAt],
    );
  }

  public async existsById(userId: UserId): Promise<boolean> {
    const result = await this.pool.query<UserExistsRow>(
      `SELECT EXISTS(SELECT 1 FROM users WHERE user_id = $1) AS exists`,
      [userId],
    );
    return result.rows[0]?.exists === true;
  }
}
