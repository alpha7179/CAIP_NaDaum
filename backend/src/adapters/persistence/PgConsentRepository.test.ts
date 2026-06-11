// PgConsentRepository 단위 테스트

import { describe, it, expect } from 'vitest';

import type { ConsentRecord } from '../../domain/auth/types.js';

import { PgConsentRepository } from './ConsentRepository.js';
import { createFakePool, type RecordedQuery } from './__fakes__/fake-pool.js';

describe('PgConsentRepository.create', () => {
  it('inserts a consent_records row with all 7 columns bound', async () => {
    const { pool, recorded } = createFakePool();
    const repo = new PgConsentRepository(pool);
    const grantedAt = new Date('2025-01-01T00:00:00.000Z');
    const record: ConsentRecord = {
      consentId: 'c-1',
      userId: 'u-1',
      consentItems: {
        privacyPolicy: true,
        nonMedicalDisclaimer: true,
        guardianNotification: true,
      },
      grantedAt,
    };

    await repo.create(record);

    expect(recorded).toHaveLength(1);
    const q = recorded[0] as RecordedQuery;
    expect(q.text).toMatch(/INSERT INTO consent_records/);
    expect(q.params).toEqual([
      'c-1',
      'u-1',
      true,
      true,
      true,
      grantedAt,
      null,
    ]);
  });

  it('binds withdrawnAt when provided', async () => {
    const { pool, recorded } = createFakePool();
    const repo = new PgConsentRepository(pool);
    const grantedAt = new Date('2025-01-01T00:00:00.000Z');
    const withdrawnAt = new Date('2025-02-01T00:00:00.000Z');

    await repo.create({
      consentId: 'c-1',
      userId: 'u-1',
      consentItems: {
        privacyPolicy: false,
        nonMedicalDisclaimer: true,
        guardianNotification: false,
      },
      grantedAt,
      withdrawnAt,
    });

    const params = (recorded[0] as RecordedQuery).params;
    expect(params[6]).toBe(withdrawnAt);
    expect(params[2]).toBe(false);
  });
});

describe('PgConsentRepository.findLatestByUserId', () => {
  it('orders by granted_at DESC and returns the most recent row', async () => {
    const grantedAt = new Date('2025-03-01T00:00:00.000Z');
    const { pool, recorded } = createFakePool({
      handler: () => ({
        rows: [
          {
            consent_id: 'c-latest',
            user_id: 'u-1',
            privacy_policy: true,
            non_medical_disclaimer: true,
            guardian_notification: true,
            granted_at: grantedAt,
            withdrawn_at: null,
          },
        ],
        rowCount: 1,
      }),
    });
    const repo = new PgConsentRepository(pool);

    const result = await repo.findLatestByUserId('u-1');

    expect(recorded[0]?.text).toMatch(/ORDER BY granted_at DESC/);
    expect(result).toEqual<ConsentRecord>({
      consentId: 'c-latest',
      userId: 'u-1',
      consentItems: {
        privacyPolicy: true,
        nonMedicalDisclaimer: true,
        guardianNotification: true,
      },
      grantedAt,
    });
  });

  it('returns undefined when no rows exist', async () => {
    const { pool } = createFakePool();
    const repo = new PgConsentRepository(pool);
    expect(await repo.findLatestByUserId('u-missing')).toBeUndefined();
  });

  it('preserves withdrawnAt in the returned record', async () => {
    const grantedAt = new Date('2025-03-01T00:00:00.000Z');
    const withdrawnAt = new Date('2025-03-02T00:00:00.000Z');
    const { pool } = createFakePool({
      handler: () => ({
        rows: [
          {
            consent_id: 'c-wd',
            user_id: 'u-1',
            privacy_policy: false,
            non_medical_disclaimer: true,
            guardian_notification: false,
            granted_at: grantedAt,
            withdrawn_at: withdrawnAt,
          },
        ],
        rowCount: 1,
      }),
    });
    const repo = new PgConsentRepository(pool);
    const result = await repo.findLatestByUserId('u-1');
    expect(result?.withdrawnAt).toEqual(withdrawnAt);
    expect(result?.consentItems.privacyPolicy).toBe(false);
  });
});

describe('PgConsentRepository.withdraw', () => {
  it('inserts a new row with withdrawnAt set and named items flipped to false', async () => {
    const grantedAt = new Date('2025-01-01T00:00:00.000Z');
    const at = new Date('2025-04-01T00:00:00.000Z');

    let call = 0;
    const { pool, recorded } = createFakePool({
      handler: () => {
        call += 1;
        if (call === 1) {
          return {
            rows: [
              {
                consent_id: 'c-prev',
                user_id: 'u-1',
                privacy_policy: true,
                non_medical_disclaimer: true,
                guardian_notification: true,
                granted_at: grantedAt,
                withdrawn_at: null,
              },
            ],
            rowCount: 1,
          };
        }
        return { rows: [], rowCount: 0 };
      },
    });
    const repo = new PgConsentRepository(pool);

    await repo.withdraw({
      consentId: 'c-new',
      userId: 'u-1',
      items: ['privacyPolicy'],
      at,
    });

    expect(recorded).toHaveLength(2);
    expect((recorded[0] as RecordedQuery).text).toMatch(/SELECT.*FROM consent_records/s);
    const insert = recorded[1] as RecordedQuery;
    expect(insert.text).toMatch(/INSERT INTO consent_records/);
    expect(insert.params).toEqual([
      'c-new',
      'u-1',
      false,
      true,
      true,
      at,
      at,
    ]);
  });

  it('inserts an all-false withdrawal row when no prior consent exists', async () => {
    const at = new Date('2025-04-01T00:00:00.000Z');
    const { pool, recorded } = createFakePool();
    const repo = new PgConsentRepository(pool);

    await repo.withdraw({
      consentId: 'c-new',
      userId: 'u-orphan',
      items: ['privacyPolicy', 'nonMedicalDisclaimer'],
      at,
    });

    const insert = recorded[1] as RecordedQuery;
    expect(insert.params.slice(2, 5)).toEqual([false, false, false]);
    expect(insert.params[5]).toBe(at);
    expect(insert.params[6]).toBe(at);
  });
});
