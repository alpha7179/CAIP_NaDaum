// PgGuardianRepository 단위 테스트

import { describe, it, expect } from 'vitest';

import type { GuardianContact } from '../../domain/auth/types.js';

import { PgGuardianRepository } from './GuardianRepository.js';
import { createFakePool, type RecordedQuery } from './__fakes__/fake-pool.js';

describe('PgGuardianRepository.createMany', () => {
  it('does not issue any SQL when contacts is empty', async () => {
    const { pool, recorded } = createFakePool();
    const repo = new PgGuardianRepository(pool);
    await repo.createMany([]);
    expect(recorded).toHaveLength(0);
  });

  it('inserts N rows in a single statement with 9 params per row', async () => {
    const { pool, recorded } = createFakePool();
    const repo = new PgGuardianRepository(pool);
    const createdAt = new Date('2025-01-15T00:00:00.000Z');
    const contacts: GuardianContact[] = [
      {
        guardianId: 'g-1',
        userId: 'u-1',
        name: '엄마',
        email: 'mom@example.com',
        phone: '+821012345678',
        emailEnabled: true,
        smsEnabled: true,
        createdAt,
      },
      {
        guardianId: 'g-2',
        userId: 'u-1',
        relationship: '아빠',
        name: '아빠',
        email: 'dad@example.com',
        phone: '+821098765432',
        emailEnabled: true,
        smsEnabled: false,
        createdAt,
      },
    ];

    await repo.createMany(contacts);

    expect(recorded).toHaveLength(1);
    const q = recorded[0] as RecordedQuery;
    expect(q.text).toMatch(/INSERT INTO guardian_contacts/);
    expect(q.text).toContain('($1, $2, $3, $4, $5, $6, $7, $8, $9), ($10, $11, $12, $13, $14, $15, $16, $17, $18)');
    expect(q.params).toEqual([
      'g-1', 'u-1', null, '엄마', 'mom@example.com', '+821012345678', true, true, createdAt,
      'g-2', 'u-1', '아빠', '아빠', 'dad@example.com', '+821098765432', true, false, createdAt,
    ]);
  });
});

describe('PgGuardianRepository.listByUserId', () => {
  it('orders by created_at ASC for deterministic output', async () => {
    const createdAt = new Date('2025-01-15T00:00:00.000Z');
    const { pool, recorded } = createFakePool({
      handler: () => ({
        rows: [
          {
            guardian_id: 'g-1',
            user_id: 'u-1',
            relationship: null,
            name: '엄마',
            email: 'mom@example.com',
            phone: '+821012345678',
            email_enabled: true,
            sms_enabled: true,
            created_at: createdAt,
          },
        ],
        rowCount: 1,
      }),
    });
    const repo = new PgGuardianRepository(pool);
    const list = await repo.listByUserId('u-1');
    expect(recorded[0]?.text).toMatch(/ORDER BY created_at ASC/);
    expect(list).toEqual<GuardianContact[]>([
      {
        guardianId: 'g-1',
        userId: 'u-1',
        name: '엄마',
        email: 'mom@example.com',
        phone: '+821012345678',
        emailEnabled: true,
        smsEnabled: true,
        createdAt,
      },
    ]);
  });

  it('returns empty array when user has no guardians', async () => {
    const { pool } = createFakePool();
    const repo = new PgGuardianRepository(pool);
    expect(await repo.listByUserId('u-empty')).toEqual([]);
  });
});
