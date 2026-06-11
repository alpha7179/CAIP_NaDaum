// SessionContext 발화 이력 FIFO 관리 및 직렬화/역직렬화 유틸
import type {
  EmotionAnalysisResult,
  EmotionProfile,
  Exchange,
  RiskSignalSnapshot,
  RiskState,
  SessionContext,
} from '@nadaum/shared';

export const MAX_EXCHANGES = 50;

// createInitialSessionContext 입력 인자
export interface CreateInitialSessionContextArgs {
  sessionId: string;
  userId: string;
  startedAt: Date;
}

export function createInitialSessionContext(
  args: CreateInitialSessionContextArgs,
): SessionContext {
  const { sessionId, userId, startedAt } = args;
  const emotionProfile: EmotionProfile = {
    utteranceScores: [],
    aggregate: {
      기쁨: 5,
      슬픔: 5,
      분노: 5,
      불안: 5,
      놀람: 5,
      혐오: 5,
      중립: 5,
    },
  };
  const riskState: RiskState = {
    current: '저위험',
    consecutiveLowerCount: 0,
    lastEvaluatedAt: startedAt,
    highRiskTriggered: false,
    perSignal: [],
  };
  return {
    sessionId,
    userId,
    stage: '상황파악',
    exchanges: [],
    cumulativeEmotion: emotionProfile,
    riskState,
    startedAt,
    lastUtteranceAt: startedAt,
  };
}

export function addExchange(
  context: SessionContext,
  exchange: Exchange,
): SessionContext {
  const next = context.exchanges.concat(exchange);
  const trimmed =
    next.length > MAX_EXCHANGES ? next.slice(next.length - MAX_EXCHANGES) : next;

  const lastUtteranceAt =
    exchange.role === 'user' ? exchange.timestamp : context.lastUtteranceAt;

  return {
    ...context,
    exchanges: trimmed,
    lastUtteranceAt,
  };
}

// SessionContext의 JSON-safe 직렬화 형태
export interface SerializedSessionContext {
  sessionId: string;
  userId: string;
  stage: SessionContext['stage'];
  exchanges: SerializedExchange[];
  cumulativeEmotion: SerializedEmotionProfile;
  riskState: SerializedRiskState;
  startedAt: string;
  lastUtteranceAt: string;
}

// 직렬화된 발화 단위
export interface SerializedExchange {
  role: Exchange['role'];
  text: string;
  timestamp: string;
}

// 직렬화된 누적 감정 프로필
export interface SerializedEmotionProfile {
  utteranceScores: SerializedEmotionAnalysisResult[];
  aggregate: EmotionProfile['aggregate'];
}

// 직렬화된 발화별 감정 분석 결과
export interface SerializedEmotionAnalysisResult {
  scores: EmotionAnalysisResult['scores'];
  distortions: EmotionAnalysisResult['distortions'];
  analyzedAt: string;
}

// 직렬화된 위험 상태
export interface SerializedRiskState {
  current: RiskState['current'];
  consecutiveLowerCount: number;
  lastEvaluatedAt: string;
  highRiskTriggered: boolean;
  perSignal: SerializedRiskSignalSnapshot[];
}

// 직렬화된 신호별 스냅샷
export interface SerializedRiskSignalSnapshot {
  signalId: string;
  level: RiskSignalSnapshot['level'];
  evaluatedAt: string;
}

export function serializeSessionContext(
  context: SessionContext,
): SerializedSessionContext {
  return {
    sessionId: context.sessionId,
    userId: context.userId,
    stage: context.stage,
    exchanges: context.exchanges.map(serializeExchange),
    cumulativeEmotion: {
      utteranceScores: context.cumulativeEmotion.utteranceScores.map(
        serializeEmotionAnalysisResult,
      ),
      aggregate: { ...context.cumulativeEmotion.aggregate },
    },
    riskState: {
      current: context.riskState.current,
      consecutiveLowerCount: context.riskState.consecutiveLowerCount,
      lastEvaluatedAt: toIso(context.riskState.lastEvaluatedAt),
      highRiskTriggered: context.riskState.highRiskTriggered,
      perSignal: context.riskState.perSignal.map(serializeRiskSignalSnapshot),
    },
    startedAt: toIso(context.startedAt),
    lastUtteranceAt: toIso(context.lastUtteranceAt),
  };
}

export function stringifySessionContext(context: SessionContext): string {
  return JSON.stringify(serializeSessionContext(context));
}

export function deserializeSessionContext(
  json: SerializedSessionContext | string | unknown,
): SessionContext {
  const parsed: unknown = typeof json === 'string' ? JSON.parse(json) : json;
  if (!isPlainObject(parsed)) {
    throw new Error('deserializeSessionContext: input is not an object');
  }
  const obj = parsed;

  const sessionId = requireString(obj, 'sessionId');
  const userId = requireString(obj, 'userId');
  const stage = requireString(obj, 'stage') as SessionContext['stage'];
  const exchangesRaw = requireArray(obj, 'exchanges');
  const cumulativeEmotionRaw = requireObject(obj, 'cumulativeEmotion');
  const riskStateRaw = requireObject(obj, 'riskState');
  const startedAt = parseIso(requireString(obj, 'startedAt'), 'startedAt');
  const lastUtteranceAt = parseIso(
    requireString(obj, 'lastUtteranceAt'),
    'lastUtteranceAt',
  );

  return {
    sessionId,
    userId,
    stage,
    exchanges: exchangesRaw.map((e, i) =>
      deserializeExchange(e, `exchanges[${i}]`),
    ),
    cumulativeEmotion: deserializeEmotionProfile(cumulativeEmotionRaw),
    riskState: deserializeRiskState(riskStateRaw),
    startedAt,
    lastUtteranceAt,
  };
}

function serializeExchange(exchange: Exchange): SerializedExchange {
  return {
    role: exchange.role,
    text: exchange.text,
    timestamp: toIso(exchange.timestamp),
  };
}

function serializeEmotionAnalysisResult(
  result: EmotionAnalysisResult,
): SerializedEmotionAnalysisResult {
  return {
    scores: { ...result.scores },
    distortions: [...result.distortions],
    analyzedAt: toIso(result.analyzedAt),
  };
}

function serializeRiskSignalSnapshot(
  snap: RiskSignalSnapshot,
): SerializedRiskSignalSnapshot {
  return {
    signalId: snap.signalId,
    level: snap.level,
    evaluatedAt: toIso(snap.evaluatedAt),
  };
}

function deserializeExchange(value: unknown, path: string): Exchange {
  if (!isPlainObject(value)) {
    throw new Error(`deserializeSessionContext: ${path} is not an object`);
  }
  const obj = value;
  const role = requireString(obj, 'role');
  if (role !== 'user' && role !== 'ai') {
    throw new Error(
      `deserializeSessionContext: ${path}.role must be 'user' | 'ai' (got: ${role})`,
    );
  }
  return {
    role,
    text: requireString(obj, 'text'),
    timestamp: parseIso(
      requireString(obj, 'timestamp'),
      `${path}.timestamp`,
    ),
  };
}

function deserializeEmotionProfile(
  value: Record<string, unknown>,
): EmotionProfile {
  const utteranceScoresRaw = requireArray(value, 'utteranceScores');
  const aggregateRaw = requireObject(value, 'aggregate');
  return {
    utteranceScores: utteranceScoresRaw.map((r, i) =>
      deserializeEmotionAnalysisResult(r, `cumulativeEmotion.utteranceScores[${i}]`),
    ),
    aggregate: aggregateRaw as unknown as EmotionProfile['aggregate'],
  };
}

function deserializeEmotionAnalysisResult(
  value: unknown,
  path: string,
): EmotionAnalysisResult {
  if (!isPlainObject(value)) {
    throw new Error(`deserializeSessionContext: ${path} is not an object`);
  }
  const obj = value;
  const scores = requireObject(obj, 'scores') as unknown as EmotionAnalysisResult['scores'];
  const distortionsRaw = requireArray(obj, 'distortions');
  const analyzedAt = parseIso(
    requireString(obj, 'analyzedAt'),
    `${path}.analyzedAt`,
  );
  return {
    scores,
    distortions: distortionsRaw as EmotionAnalysisResult['distortions'],
    analyzedAt,
  };
}

function deserializeRiskState(value: Record<string, unknown>): RiskState {
  const current = requireString(value, 'current') as RiskState['current'];
  const consecutiveLowerCount = requireNumber(value, 'consecutiveLowerCount');
  const lastEvaluatedAt = parseIso(
    requireString(value, 'lastEvaluatedAt'),
    'riskState.lastEvaluatedAt',
  );
  const highRiskTriggered = requireBoolean(value, 'highRiskTriggered');
  const perSignalRaw = requireArray(value, 'perSignal');
  return {
    current,
    consecutiveLowerCount,
    lastEvaluatedAt,
    highRiskTriggered,
    perSignal: perSignalRaw.map((s, i) =>
      deserializeRiskSignalSnapshot(s, `riskState.perSignal[${i}]`),
    ),
  };
}

function deserializeRiskSignalSnapshot(
  value: unknown,
  path: string,
): RiskSignalSnapshot {
  if (!isPlainObject(value)) {
    throw new Error(`deserializeSessionContext: ${path} is not an object`);
  }
  const obj = value;
  return {
    signalId: requireString(obj, 'signalId'),
    level: requireString(obj, 'level') as RiskSignalSnapshot['level'],
    evaluatedAt: parseIso(
      requireString(obj, 'evaluatedAt'),
      `${path}.evaluatedAt`,
    ),
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireString(obj: Record<string, unknown>, key: string): string {
  const v = obj[key];
  if (typeof v !== 'string') {
    throw new Error(
      `deserializeSessionContext: field "${key}" must be a string (got: ${typeof v})`,
    );
  }
  return v;
}

function requireNumber(obj: Record<string, unknown>, key: string): number {
  const v = obj[key];
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    throw new Error(
      `deserializeSessionContext: field "${key}" must be a finite number (got: ${typeof v})`,
    );
  }
  return v;
}

function requireBoolean(obj: Record<string, unknown>, key: string): boolean {
  const v = obj[key];
  if (typeof v !== 'boolean') {
    throw new Error(
      `deserializeSessionContext: field "${key}" must be a boolean (got: ${typeof v})`,
    );
  }
  return v;
}

function requireArray(obj: Record<string, unknown>, key: string): unknown[] {
  const v = obj[key];
  if (!Array.isArray(v)) {
    throw new Error(
      `deserializeSessionContext: field "${key}" must be an array`,
    );
  }
  return v;
}

function requireObject(
  obj: Record<string, unknown>,
  key: string,
): Record<string, unknown> {
  const v = obj[key];
  if (!isPlainObject(v)) {
    throw new Error(
      `deserializeSessionContext: field "${key}" must be an object`,
    );
  }
  return v;
}

function toIso(date: Date): string {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new Error('serializeSessionContext: invalid Date value');
  }
  return date.toISOString();
}

function parseIso(text: string, path: string): Date {
  const d = new Date(text);
  if (Number.isNaN(d.getTime())) {
    throw new Error(
      `deserializeSessionContext: ${path} is not a valid ISO 8601 datetime (got: ${text})`,
    );
  }
  return d;
}
