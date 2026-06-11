// SessionContext 단위 테스트
import type {
  EmotionAnalysisResult,
  Exchange,
  RiskState,
  SessionContext,
} from '@nadaum/shared';
import { describe, expect, it } from 'vitest';

import {
  MAX_EXCHANGES,
  addExchange,
  createInitialSessionContext,
  deserializeSessionContext,
  serializeSessionContext,
  stringifySessionContext,
} from './SessionContext.js';

function makeExchange(role: 'user' | 'ai', n: number): Exchange {
  return {
    role,
    text: `${role}#${n}`,
    timestamp: new Date(2024, 0, 1, 0, 0, n),
  };
}

function baseContext(): SessionContext {
  return createInitialSessionContext({
    sessionId: 'sess-1',
    userId: 'user-1',
    startedAt: new Date('2024-01-01T00:00:00.000Z'),
  });
}

describe('createInitialSessionContext', () => {
  it('creates an empty session in the 상황파악 stage with a 저위험 baseline', () => {
    const ctx = baseContext();

    expect(ctx.sessionId).toBe('sess-1');
    expect(ctx.userId).toBe('user-1');
    expect(ctx.stage).toBe('상황파악');
    expect(ctx.exchanges).toEqual([]);
    expect(ctx.cumulativeEmotion.utteranceScores).toEqual([]);
    expect(ctx.riskState.current).toBe('저위험');
    expect(ctx.riskState.highRiskTriggered).toBe(false);
    expect(ctx.startedAt.toISOString()).toBe('2024-01-01T00:00:00.000Z');
    expect(ctx.lastUtteranceAt.toISOString()).toBe('2024-01-01T00:00:00.000Z');
  });
});

describe('addExchange (FIFO 경계)', () => {
  it('appends below the cap (length grows by 1 each call)', () => {
    let ctx = baseContext();
    for (let i = 0; i < 5; i += 1) {
      ctx = addExchange(ctx, makeExchange('user', i));
    }
    expect(ctx.exchanges).toHaveLength(5);
    expect(ctx.exchanges[0]?.text).toBe('user#0');
    expect(ctx.exchanges[4]?.text).toBe('user#4');
  });

  it('caps at 50 and drops the oldest entry on the 51st insert', () => {
    let ctx = baseContext();
    for (let i = 0; i < MAX_EXCHANGES; i += 1) {
      ctx = addExchange(ctx, makeExchange('user', i));
    }
    expect(ctx.exchanges).toHaveLength(MAX_EXCHANGES);
    ctx = addExchange(ctx, makeExchange('user', MAX_EXCHANGES));
    expect(ctx.exchanges).toHaveLength(MAX_EXCHANGES);
    expect(ctx.exchanges[0]?.text).toBe('user#1');
    expect(ctx.exchanges[MAX_EXCHANGES - 1]?.text).toBe(`user#${MAX_EXCHANGES}`);
  });

  it('after 60 inserts retains exactly 50 (오래된 10개 폐기)', () => {
    let ctx = baseContext();
    for (let i = 0; i < 60; i += 1) {
      ctx = addExchange(ctx, makeExchange('user', i));
    }
    expect(ctx.exchanges).toHaveLength(MAX_EXCHANGES);
    expect(ctx.exchanges[0]?.text).toBe('user#10');
    expect(ctx.exchanges[MAX_EXCHANGES - 1]?.text).toBe('user#59');
  });

  it('does not mutate the input context or its exchanges array', () => {
    const ctx = baseContext();
    const exchangesRef = ctx.exchanges;
    const lastUtteranceAtRef = ctx.lastUtteranceAt;

    const next = addExchange(ctx, makeExchange('user', 0));

    expect(ctx.exchanges).toBe(exchangesRef);
    expect(ctx.exchanges).toHaveLength(0);
    expect(ctx.lastUtteranceAt).toBe(lastUtteranceAtRef);
    expect(next).not.toBe(ctx);
    expect(next.exchanges).not.toBe(ctx.exchanges);
    expect(next.exchanges).toHaveLength(1);
  });

  it('updates lastUtteranceAt only for user exchanges', () => {
    const ctx = baseContext();
    const userTs = new Date('2024-01-01T00:05:00.000Z');
    const aiTs = new Date('2024-01-01T00:10:00.000Z');

    const afterUser = addExchange(ctx, {
      role: 'user',
      text: 'hi',
      timestamp: userTs,
    });
    expect(afterUser.lastUtteranceAt.toISOString()).toBe(userTs.toISOString());

    const afterAi = addExchange(afterUser, {
      role: 'ai',
      text: 'hello',
      timestamp: aiTs,
    });
    expect(afterAi.lastUtteranceAt.toISOString()).toBe(userTs.toISOString());
  });
});

describe('serialize/deserialize round trip', () => {
  function buildPopulatedContext(): SessionContext {
    const ctx = baseContext();
    const utteranceTs = new Date('2024-01-01T00:01:00.000Z');
    const analyzedAt = new Date('2024-01-01T00:01:01.000Z');
    const evaluatedAt = new Date('2024-01-01T00:01:02.000Z');

    const utteranceScore: EmotionAnalysisResult = {
      scores: { 기쁨: 6, 슬픔: 4, 분노: 3, 불안: 7, 놀람: 2, 혐오: 1, 중립: 5 },
      distortions: ['파국화', '감정적추론'],
      analyzedAt,
    };

    const riskState: RiskState = {
      current: '중위험',
      consecutiveLowerCount: 1,
      lastEvaluatedAt: evaluatedAt,
      highRiskTriggered: false,
      perSignal: [
        { signalId: 'keyword', level: '저위험', evaluatedAt },
        { signalId: 'emotion_score', level: '중위험', evaluatedAt },
      ],
    };

    return {
      ...addExchange(ctx, {
        role: 'user',
        text: '오늘 너무 힘들었어',
        timestamp: utteranceTs,
      }),
      stage: '감정탐색',
      cumulativeEmotion: {
        utteranceScores: [utteranceScore],
        aggregate: utteranceScore.scores,
      },
      riskState,
    };
  }

  it('preserves Date objects and EmotionProfile shape through a round trip', () => {
    const ctx = buildPopulatedContext();
    const serialized = serializeSessionContext(ctx);
    const restored = deserializeSessionContext(serialized);

    expect(restored).toEqual(ctx);
    expect(restored.startedAt).toBeInstanceOf(Date);
    expect(restored.lastUtteranceAt).toBeInstanceOf(Date);
    expect(restored.exchanges[0]?.timestamp).toBeInstanceOf(Date);
    expect(
      restored.cumulativeEmotion.utteranceScores[0]?.analyzedAt,
    ).toBeInstanceOf(Date);
    expect(restored.riskState.lastEvaluatedAt).toBeInstanceOf(Date);
    expect(restored.riskState.perSignal[0]?.evaluatedAt).toBeInstanceOf(Date);
    expect(restored.cumulativeEmotion.aggregate).toEqual(
      ctx.cumulativeEmotion.aggregate,
    );
  });

  it('serialize produces JSON-safe values (Dates become ISO strings)', () => {
    const ctx = buildPopulatedContext();
    const serialized = serializeSessionContext(ctx);

    expect(typeof serialized.startedAt).toBe('string');
    expect(typeof serialized.lastUtteranceAt).toBe('string');
    expect(serialized.startedAt).toBe(ctx.startedAt.toISOString());
    expect(serialized.exchanges[0]?.timestamp).toBe(
      ctx.exchanges[0]?.timestamp.toISOString(),
    );
    const json = JSON.stringify(serialized);
    expect(typeof json).toBe('string');
    expect(json).toContain('"startedAt"');
  });

  it('stringifySessionContext is equivalent to JSON.stringify(serialize(...))', () => {
    const ctx = buildPopulatedContext();
    expect(stringifySessionContext(ctx)).toBe(
      JSON.stringify(serializeSessionContext(ctx)),
    );
    const restored = deserializeSessionContext(stringifySessionContext(ctx));
    expect(restored).toEqual(ctx);
  });

  it('deserialize accepts a JSON string input', () => {
    const ctx = buildPopulatedContext();
    const text = stringifySessionContext(ctx);
    const restored = deserializeSessionContext(text);
    expect(restored).toEqual(ctx);
  });

  it('throws on invalid input shape', () => {
    expect(() => deserializeSessionContext('not-json')).toThrow();
    expect(() => deserializeSessionContext({ sessionId: 'x' })).toThrow();
    expect(() =>
      deserializeSessionContext({
        ...serializeSessionContext(baseContext()),
        startedAt: 'not-a-date',
      }),
    ).toThrow(/startedAt/);
  });
});
