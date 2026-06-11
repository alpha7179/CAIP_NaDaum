// SafetyAuditLogger — 안전 감사 로그(safety_audit_log) 어댑터
import { randomUUID } from 'node:crypto';

import type { RiskLevel } from '@nadaum/shared';

export type SafetyAuditEventType =
  | 'risk_evaluated'
  | 'low_intervention'
  | 'medium_intervention'
  | 'high_intervention'
  | 'high_intervention_abnormal_end';

export interface ChannelNotificationPayload {
  readonly channel_id?: string;
  readonly attempts?: number;
  readonly fallback_channel_used?: string | null;
  readonly final_status?: 'success' | 'failed';
  readonly attempt_timestamps?: ReadonlyArray<Date>;
  readonly scheduled_at?: Date | null;
}

export interface RiskInterventionPayload {
  readonly risk_level?: RiskLevel;
  readonly triggered_signals?: ReadonlyArray<{
    readonly signalId: string;
    readonly level: RiskLevel;
  }>;
  readonly displayed_contacts?: ReadonlyArray<string>;
  readonly warning_message?: string;
  readonly session_forced_to_finalize?: boolean;
  readonly daily_tips?: ReadonlyArray<string>;
  readonly referrals?: ReadonlyArray<string>;
  readonly reason?: string;
}

export type SafetyAuditPayload = ChannelNotificationPayload &
  RiskInterventionPayload & {
    readonly [extraKey: string]: unknown;
  };

export interface SafetyAuditEvent {
  readonly auditId?: string;
  readonly sessionId: string;
  readonly userId: string;
  readonly eventType: SafetyAuditEventType;
  readonly riskLevel?: RiskLevel;
  readonly payload: SafetyAuditPayload;
  readonly occurredAt?: Date;
}

export interface SafetyAuditRecord {
  readonly auditId: string;
  readonly sessionId: string;
  readonly userId: string;
  readonly eventType: SafetyAuditEventType;
  readonly riskLevel: RiskLevel | null;
  readonly payload: Record<string, unknown>;
  readonly occurredAt: Date;
}

export interface SafetyAuditLogger {
  logEvent(event: SafetyAuditEvent): Promise<void>;
}

export function jsonSafe(value: unknown): unknown {
  if (value === null || value === undefined) return value ?? null;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) {
    return value.map((v) => jsonSafe(v));
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v === undefined) continue;
      out[k] = jsonSafe(v);
    }
    return out;
  }
  return value;
}

function normalizePayload(payload: SafetyAuditPayload): Record<string, unknown> {
  const normalized = jsonSafe(payload);
  if (normalized === null || typeof normalized !== 'object' || Array.isArray(normalized)) {
    return {};
  }
  return normalized as Record<string, unknown>;
}

export interface QueryablePool {
  query<R extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: ReadonlyArray<unknown>,
  ): Promise<{ rows: R[]; rowCount: number | null }>;
}

const INSERT_SQL = `
  INSERT INTO safety_audit_log
    (audit_id, session_id, user_id, event_type, risk_level, payload, occurred_at)
  VALUES
    ($1, $2, $3, $4, $5, $6::jsonb, COALESCE($7, now()))
`;

export class PgSafetyAuditLogger implements SafetyAuditLogger {
  constructor(private readonly pool: QueryablePool) {}

  async logEvent(event: SafetyAuditEvent): Promise<void> {
    const auditId = event.auditId ?? randomUUID();
    const payload = normalizePayload(event.payload);
    const params: ReadonlyArray<unknown> = [
      auditId,
      event.sessionId,
      event.userId,
      event.eventType,
      event.riskLevel ?? null,
      JSON.stringify(payload),
      event.occurredAt ?? null,
    ];
    await this.pool.query(INSERT_SQL, params);
  }
}

export class InMemorySafetyAuditLogger implements SafetyAuditLogger {
  private readonly store: SafetyAuditRecord[] = [];

  async logEvent(event: SafetyAuditEvent): Promise<void> {
    const record: SafetyAuditRecord = {
      auditId: event.auditId ?? randomUUID(),
      sessionId: event.sessionId,
      userId: event.userId,
      eventType: event.eventType,
      riskLevel: event.riskLevel ?? null,
      payload: normalizePayload(event.payload),
      occurredAt: event.occurredAt ?? new Date(),
    };
    this.store.push(record);
  }

  list(): SafetyAuditRecord[] {
    return this.store.slice();
  }

  listBySession(sessionId: string): SafetyAuditRecord[] {
    return this.store.filter((r) => r.sessionId === sessionId);
  }

  clear(): void {
    this.store.length = 0;
  }
}
