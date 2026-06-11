// SafetyAuditLogger 단위 테스트
import { describe, expect, it } from 'vitest';

import {
  InMemorySafetyAuditLogger,
  PgSafetyAuditLogger,
  jsonSafe,
  type QueryablePool,
  type SafetyAuditEvent,
} from './SafetyAuditLogger.js';

describe('jsonSafe', () => {
  it('converts Date to ISO-8601 string', () => {
    const d = new Date('2025-01-02T03:04:05.000Z');
    expect(jsonSafe(d)).toBe('2025-01-02T03:04:05.000Z');
  });

  it('recursively normalizes arrays of Dates', () => {
    const ts = [
      new Date('2025-01-01T00:00:00Z'),
      new Date('2025-01-01T00:01:00Z'),
    ];
    expect(jsonSafe(ts)).toEqual([
      '2025-01-01T00:00:00.000Z',
      '2025-01-01T00:01:00.000Z',
    ]);
  });

  it('recursively normalizes nested object values and drops undefined keys', () => {
    const input = {
      channel_id: 'sms',
      attempts: 2,
      fallback_channel_used: null,
      final_status: 'success' as const,
      attempt_timestamps: [
        new Date('2025-01-01T00:00:00Z'),
        new Date('2025-01-01T00:00:05Z'),
      ],
      scheduled_at: undefined,
    };
    expect(jsonSafe(input)).toEqual({
      channel_id: 'sms',
      attempts: 2,
      fallback_channel_used: null,
      final_status: 'success',
      attempt_timestamps: [
        '2025-01-01T00:00:00.000Z',
        '2025-01-01T00:00:05.000Z',
      ],
    });
  });

  it('passes through primitive values unchanged', () => {
    expect(jsonSafe('hello')).toBe('hello');
    expect(jsonSafe(42)).toBe(42);
    expect(jsonSafe(true)).toBe(true);
    expect(jsonSafe(null)).toBe(null);
  });
});

describe('InMemorySafetyAuditLogger', () => {
  it('records each of the 5 MVP event types as a single row', async () => {
    const logger = new InMemorySafetyAuditLogger();
    const sessionId = '11111111-1111-1111-1111-111111111111';
    const userId = '22222222-2222-2222-2222-222222222222';

    const events: SafetyAuditEvent[] = [
      {
        sessionId,
        userId,
        eventType: 'risk_evaluated',
        riskLevel: '저위험',
        payload: {
          risk_level: '저위험',
          triggered_signals: [{ signalId: 'keyword', level: '저위험' }],
        },
      },
      {
        sessionId,
        userId,
        eventType: 'low_intervention',
        riskLevel: '저위험',
        payload: { daily_tips: ['breathing-1', 'walk-2'] },
      },
      {
        sessionId,
        userId,
        eventType: 'medium_intervention',
        riskLevel: '중위험',
        payload: { referrals: ['1393', 'counseling-center-A'] },
      },
      {
        sessionId,
        userId,
        eventType: 'high_intervention',
        riskLevel: '고위험',
        payload: {
          displayed_contacts: ['1393', '1577-0199'],
          warning_message: '지금 매우 힘드신 상태로 보입니다.',
          session_forced_to_finalize: true,
        },
      },
      {
        sessionId,
        userId,
        eventType: 'high_intervention_abnormal_end',
        riskLevel: '고위험',
        payload: { reason: 'client_disconnect' },
      },
    ];

    for (const e of events) {
      await logger.logEvent(e);
    }

    const all = logger.list();
    expect(all).toHaveLength(5);
    expect(all.map((r) => r.eventType)).toEqual([
      'risk_evaluated',
      'low_intervention',
      'medium_intervention',
      'high_intervention',
      'high_intervention_abnormal_end',
    ]);
    for (const r of all) {
      expect(r.sessionId).toBe(sessionId);
      expect(r.userId).toBe(userId);
      expect(typeof r.auditId).toBe('string');
      expect(r.auditId.length).toBeGreaterThan(0);
    }
  });

  it('preserves the standard channel notification keys per Requirement 14.8', async () => {
    const logger = new InMemorySafetyAuditLogger();
    const t1 = new Date('2025-01-01T00:00:00Z');
    const t2 = new Date('2025-01-01T00:00:05Z');
    const scheduled = new Date('2025-01-02T00:00:00Z');

    await logger.logEvent({
      sessionId: 's1',
      userId: 'u1',
      eventType: 'high_intervention',
      riskLevel: '고위험',
      payload: {
        channel_id: 'sms',
        attempts: 2,
        fallback_channel_used: null,
        final_status: 'success',
        attempt_timestamps: [t1, t2],
        scheduled_at: scheduled,
        displayed_contacts: ['1393', '1577-0199'],
        warning_message: '경고',
        session_forced_to_finalize: true,
      },
    });

    const [record] = logger.list();
    expect(record).toBeDefined();
    expect(record!.payload).toEqual({
      channel_id: 'sms',
      attempts: 2,
      fallback_channel_used: null,
      final_status: 'success',
      attempt_timestamps: [
        '2025-01-01T00:00:00.000Z',
        '2025-01-01T00:00:05.000Z',
      ],
      scheduled_at: '2025-01-02T00:00:00.000Z',
      displayed_contacts: ['1393', '1577-0199'],
      warning_message: '경고',
      session_forced_to_finalize: true,
    });
  });

  it('uses provided auditId/occurredAt when set (testing determinism)', async () => {
    const logger = new InMemorySafetyAuditLogger();
    const auditId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    const at = new Date('2025-03-04T05:06:07.000Z');

    await logger.logEvent({
      auditId,
      occurredAt: at,
      sessionId: 's1',
      userId: 'u1',
      eventType: 'risk_evaluated',
      riskLevel: '저위험',
      payload: {},
    });

    const [r] = logger.list();
    expect(r!.auditId).toBe(auditId);
    expect(r!.occurredAt).toEqual(at);
  });

  it('listBySession filters and clear resets state', async () => {
    const logger = new InMemorySafetyAuditLogger();
    await logger.logEvent({
      sessionId: 'a',
      userId: 'u',
      eventType: 'risk_evaluated',
      riskLevel: '저위험',
      payload: {},
    });
    await logger.logEvent({
      sessionId: 'b',
      userId: 'u',
      eventType: 'risk_evaluated',
      riskLevel: '저위험',
      payload: {},
    });
    expect(logger.listBySession('a')).toHaveLength(1);
    expect(logger.listBySession('b')).toHaveLength(1);

    logger.clear();
    expect(logger.list()).toEqual([]);
  });
});

interface CapturedQuery {
  readonly text: string;
  readonly values: ReadonlyArray<unknown>;
}

function makeFakePool(): {
  pool: QueryablePool;
  queries: CapturedQuery[];
} {
  const queries: CapturedQuery[] = [];
  const pool: QueryablePool = {
    async query<R extends Record<string, unknown>>(
      text: string,
      values?: ReadonlyArray<unknown>,
    ) {
      queries.push({ text, values: values ?? [] });
      return { rows: [] as R[], rowCount: 1 };
    },
  };
  return { pool, queries };
}

describe('PgSafetyAuditLogger', () => {
  it('issues a single INSERT into safety_audit_log per event', async () => {
    const { pool, queries } = makeFakePool();
    const logger = new PgSafetyAuditLogger(pool);

    await logger.logEvent({
      auditId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      sessionId: 's1',
      userId: 'u1',
      eventType: 'risk_evaluated',
      riskLevel: '중위험',
      payload: {
        risk_level: '중위험',
        triggered_signals: [{ signalId: 'emotion_score', level: '중위험' }],
      },
      occurredAt: new Date('2025-01-01T00:00:00Z'),
    });

    expect(queries).toHaveLength(1);
    const q = queries[0]!;
    expect(q.text).toMatch(/INSERT INTO safety_audit_log/);
    expect(q.text).toMatch(/\$6::jsonb/);

    expect(q.values[0]).toBe('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
    expect(q.values[1]).toBe('s1');
    expect(q.values[2]).toBe('u1');
    expect(q.values[3]).toBe('risk_evaluated');
    expect(q.values[4]).toBe('중위험');

    const payloadJson = q.values[5];
    expect(typeof payloadJson).toBe('string');
    const parsed = JSON.parse(payloadJson as string);
    expect(parsed).toEqual({
      risk_level: '중위험',
      triggered_signals: [{ signalId: 'emotion_score', level: '중위험' }],
    });

    expect(q.values[6]).toBeInstanceOf(Date);
  });

  it('serializes Date payload values as ISO strings into JSONB', async () => {
    const { pool, queries } = makeFakePool();
    const logger = new PgSafetyAuditLogger(pool);
    const t1 = new Date('2025-01-01T00:00:00Z');
    const scheduled = new Date('2025-01-02T00:00:00Z');

    await logger.logEvent({
      sessionId: 's1',
      userId: 'u1',
      eventType: 'high_intervention',
      riskLevel: '고위험',
      payload: {
        channel_id: 'sms',
        attempts: 1,
        fallback_channel_used: null,
        final_status: 'failed',
        attempt_timestamps: [t1],
        scheduled_at: scheduled,
      },
    });

    const q = queries[0]!;
    const parsed = JSON.parse(q.values[5] as string);
    expect(parsed).toEqual({
      channel_id: 'sms',
      attempts: 1,
      fallback_channel_used: null,
      final_status: 'failed',
      attempt_timestamps: ['2025-01-01T00:00:00.000Z'],
      scheduled_at: '2025-01-02T00:00:00.000Z',
    });
  });

  it('generates an auditId when caller does not supply one', async () => {
    const { pool, queries } = makeFakePool();
    const logger = new PgSafetyAuditLogger(pool);

    await logger.logEvent({
      sessionId: 's1',
      userId: 'u1',
      eventType: 'high_intervention_abnormal_end',
      riskLevel: '고위험',
      payload: { reason: 'client_disconnect' },
    });

    const auditId = queries[0]!.values[0];
    expect(typeof auditId).toBe('string');
    expect(auditId as string).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it('passes null occurred_at to allow PostgreSQL default now()', async () => {
    const { pool, queries } = makeFakePool();
    const logger = new PgSafetyAuditLogger(pool);

    await logger.logEvent({
      sessionId: 's1',
      userId: 'u1',
      eventType: 'low_intervention',
      riskLevel: '저위험',
      payload: { daily_tips: ['t1'] },
    });

    expect(queries[0]!.values[6]).toBeNull();
    expect(queries[0]!.text).toMatch(/COALESCE\(\$7, now\(\)\)/);
  });

  it('records null risk_level when omitted (e.g., ambient audit events)', async () => {
    const { pool, queries } = makeFakePool();
    const logger = new PgSafetyAuditLogger(pool);

    await logger.logEvent({
      sessionId: 's1',
      userId: 'u1',
      eventType: 'risk_evaluated',
      payload: {},
    });

    expect(queries[0]!.values[4]).toBeNull();
  });
});
