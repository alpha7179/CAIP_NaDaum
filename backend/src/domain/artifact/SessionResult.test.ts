// SessionResult 변환 함수 단위 테스트
import type {
  CognitiveDistortion,
  EmotionAnalysisResult,
  EmotionScores,
  Exchange,
  RiskTrajectoryPoint,
  SessionContext,
} from '@nadaum/shared';
import { COGNITIVE_DISTORTIONS } from '@nadaum/shared';
import { describe, expect, it } from 'vitest';

import { fromSessionContext } from './SessionResult.js';

const FIXED_AGGREGATE: EmotionScores = {
  기쁨: 3,
  슬픔: 7,
  분노: 5,
  불안: 8,
  놀람: 2,
  혐오: 4,
  중립: 5,
};

function makeExchange(
  role: 'user' | 'ai',
  text: string,
  timestamp: Date,
): Exchange {
  return { role, text, timestamp };
}

function makeAnalysis(
  scores: EmotionScores,
  distortions: CognitiveDistortion[],
  analyzedAt: Date,
): EmotionAnalysisResult {
  return { scores, distortions, analyzedAt };
}

function makeContext(overrides: Partial<SessionContext> = {}): SessionContext {
  const t0 = new Date('2025-01-01T00:00:00Z');
  return {
    sessionId: 'sess-1',
    userId: 'user-1',
    stage: '감정탐색',
    exchanges: [
      makeExchange('user', '안녕', t0),
      makeExchange('ai', '안녕하세요', t0),
    ],
    cumulativeEmotion: {
      utteranceScores: [
        makeAnalysis(FIXED_AGGREGATE, ['흑백논리'], t0),
        makeAnalysis(FIXED_AGGREGATE, ['파국화', '흑백논리'], t0),
      ],
      aggregate: { ...FIXED_AGGREGATE },
    },
    riskState: {
      current: '저위험',
      consecutiveLowerCount: 0,
      lastEvaluatedAt: t0,
      highRiskTriggered: false,
      perSignal: [],
    },
    startedAt: t0,
    lastUtteranceAt: t0,
    ...overrides,
  };
}

describe('fromSessionContext', () => {
  it('preserves session/user identity, exchanges, and endedAt', () => {
    const ctx = makeContext();
    const trajectory: RiskTrajectoryPoint[] = [];
    const endedAt = new Date('2025-01-01T00:10:00Z');

    const result = fromSessionContext(ctx, trajectory, endedAt);

    expect(result.sessionId).toBe('sess-1');
    expect(result.userId).toBe('user-1');
    expect(result.exchanges).toEqual(ctx.exchanges);
    expect(result.endedAt).toEqual(endedAt);
  });

  it('uses cumulativeEmotion.aggregate as combinedScores under text_only policy', () => {
    const ctx = makeContext();
    const result = fromSessionContext(ctx, [], new Date());

    expect(result.cumulativeEmotion.policy).toBe('text_only');
    expect(result.cumulativeEmotion.combinedScores).toEqual(FIXED_AGGREGATE);
    expect(result.cumulativeEmotion.missingChannels).toEqual([]);
  });

  it('maps the latest utterance analysis to a single text channel result', () => {
    const ctx = makeContext();
    const result = fromSessionContext(ctx, [], new Date());

    expect(result.cumulativeEmotion.perChannel).toHaveLength(1);
    const ch = result.cumulativeEmotion.perChannel[0];
    expect(ch).toBeDefined();
    expect(ch?.channelId).toBe('text');
    expect(ch?.scores).toEqual(FIXED_AGGREGATE);
    expect(ch?.distortions).toEqual(['파국화', '흑백논리']);
  });

  it('returns empty perChannel when no utterance analyses are available', () => {
    const ctx = makeContext({
      cumulativeEmotion: {
        utteranceScores: [],
        aggregate: { ...FIXED_AGGREGATE },
      },
    });

    const result = fromSessionContext(ctx, [], new Date());

    expect(result.cumulativeEmotion.perChannel).toEqual([]);
    expect(result.cumulativeEmotion.combinedScores).toEqual(FIXED_AGGREGATE);
  });

  it('aggregates cognitive distortions deterministically and drops unknown values', () => {
    const t0 = new Date('2025-01-01T00:00:00Z');
    const ctx = makeContext({
      cumulativeEmotion: {
        utteranceScores: [
          makeAnalysis(FIXED_AGGREGATE, ['감정적추론', '흑백논리'], t0),
          makeAnalysis(
            FIXED_AGGREGATE,
            ['파국화', 'unknown' as unknown as CognitiveDistortion],
            t0,
          ),
          makeAnalysis(FIXED_AGGREGATE, ['흑백논리', '과잉일반화'], t0),
        ],
        aggregate: { ...FIXED_AGGREGATE },
      },
    });

    const result = fromSessionContext(ctx, [], new Date());

    expect(result.distortions).toEqual([
      '흑백논리',
      '과잉일반화',
      '파국화',
      '감정적추론',
    ]);
    for (const d of result.distortions) {      expect(COGNITIVE_DISTORTIONS).toContain(d);
    }
  });

  it('preserves riskTrajectory contents', () => {
    const t0 = new Date('2025-01-01T00:00:00Z');
    const t1 = new Date('2025-01-01T00:01:00Z');
    const trajectory: RiskTrajectoryPoint[] = [
      {
        at: t0,
        level: '저위험',
        perSignal: [{ signalId: 'keyword', level: '저위험' }],
      },
      {
        at: t1,
        level: '중위험',
        perSignal: [
          { signalId: 'keyword', level: '저위험' },
          { signalId: 'emotion_score', level: '중위험' },
        ],
      },
    ];

    const result = fromSessionContext(makeContext(), trajectory, new Date());

    expect(result.riskTrajectory).toEqual(trajectory);
    expect(result.riskTrajectory).not.toBe(trajectory);
  });

  it('does not mutate the input context or trajectory', () => {
    const ctx = makeContext();
    const trajectory: RiskTrajectoryPoint[] = [
      {
        at: new Date('2025-01-01T00:00:00Z'),
        level: '저위험',
        perSignal: [{ signalId: 'keyword', level: '저위험' }],
      },
    ];

    const ctxSnapshot = JSON.stringify(ctx);
    const trajSnapshot = JSON.stringify(trajectory);

    fromSessionContext(ctx, trajectory, new Date('2025-01-01T00:10:00Z'));

    expect(JSON.stringify(ctx)).toBe(ctxSnapshot);
    expect(JSON.stringify(trajectory)).toBe(trajSnapshot);
  });
});
