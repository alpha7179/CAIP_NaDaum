// RiskEvaluator 단위 테스트

import type { EmotionScores, RiskLevel, RiskState } from '@nadaum/shared';
import { describe, expect, it } from 'vitest';

import { EmotionScoreSignal } from './EmotionScoreSignal.js';
import { KeywordSignal, type KeywordLookup } from './KeywordSignal.js';
import {
  DOWNWARD_TRANSITION_THRESHOLD,
  RiskEvaluator,
  createInitialRiskState,
  createMvpRiskEvaluator,
} from './RiskEvaluator.js';
import type { RiskInput, RiskSignal } from './RiskSignal.js';
import { SuicidalityModelSignal } from './SuicidalityModelSignal.js';

const NEUTRAL_SCORES: EmotionScores = {
  기쁨: 5,
  슬픔: 5,
  분노: 5,
  불안: 5,
  놀람: 5,
  혐오: 5,
  중립: 5,
};

function inputOf(
  text: string,
  scoreOverrides: Partial<EmotionScores> = {},
): RiskInput {
  return {
    text,
    emotionScores: { ...NEUTRAL_SCORES, ...scoreOverrides },
  };
}

// 테스트용 고정 결과 신호
class FixedSignal implements RiskSignal {
  public constructor(
    public readonly signalId: string,
    private level: RiskLevel,
  ) {}
  public setLevel(level: RiskLevel): void {
    this.level = level;
  }
  public evaluate(): RiskLevel {
    return this.level;
  }
}

class StubKeywordLookup implements KeywordLookup {
  public constructor(private readonly keywords: ReadonlyArray<string>) {}
  public isHighRisk(text: string): boolean {
    return this.keywords.some((kw) => kw.length > 0 && text.includes(kw));
  }
  public loadKeywords(): ReadonlyArray<string> {
    return this.keywords;
  }
}

describe('RiskEvaluator.registerSignal', () => {
  it('rejects duplicate signalId', () => {
    const evaluator = new RiskEvaluator();
    evaluator.registerSignal(new FixedSignal('keyword', '저위험'));
    expect(() =>
      evaluator.registerSignal(new FixedSignal('keyword', '고위험')),
    ).toThrowError(/duplicate/i);
  });

  it('records registered signal ids in registration order', () => {
    const evaluator = new RiskEvaluator();
    evaluator.registerSignal(new FixedSignal('a', '저위험'));
    evaluator.registerSignal(new FixedSignal('b', '저위험'));
    expect(evaluator.registeredSignalIds).toEqual(['a', 'b']);
  });
});

describe('RiskEvaluator.evaluateUtterance — combined decision', () => {
  it('returns "저위험" when no signals are registered', () => {
    const evaluator = new RiskEvaluator();
    const prev = createInitialRiskState(new Date('2025-01-01T00:00:00Z'));
    const { latest, nextState } = evaluator.evaluateUtterance(
      inputOf('hello'),
      prev,
    );
    expect(latest.combinedLevel).toBe('저위험');
    expect(latest.perSignal).toEqual([]);
    expect(nextState.current).toBe('저위험');
    expect(nextState.perSignal).toEqual([]);
  });

  it('takes the maximum risk among signals (저 + 고 → 고)', () => {
    const evaluator = new RiskEvaluator();
    evaluator.registerSignal(new FixedSignal('low', '저위험'));
    evaluator.registerSignal(new FixedSignal('high', '고위험'));
    const prev = createInitialRiskState();
    const { latest } = evaluator.evaluateUtterance(inputOf('x'), prev);
    expect(latest.combinedLevel).toBe('고위험');
  });
});

describe('RiskEvaluator.applyTransition — 상승 즉시', () => {
  it('promotes immediately on upward transition (저 → 중)', () => {
    const evaluator = new RiskEvaluator();
    const prev = createInitialRiskState();
    const next = evaluator.applyTransition(prev, '중위험');
    expect(next.current).toBe('중위험');
    expect(next.consecutiveLowerCount).toBe(0);
  });

  it('promotes immediately to 고위험 and sets highRiskTriggered', () => {
    const evaluator = new RiskEvaluator();
    const prev = createInitialRiskState();
    const next = evaluator.applyTransition(prev, '고위험');
    expect(next.current).toBe('고위험');
    expect(next.highRiskTriggered).toBe(true);
  });

  it('resets consecutiveLowerCount on equal transition', () => {
    const evaluator = new RiskEvaluator();
    const prev: RiskState = {
      ...createInitialRiskState(),
      current: '중위험',
      consecutiveLowerCount: 2,
    };
    const next = evaluator.applyTransition(prev, '중위험');
    expect(next.current).toBe('중위험');
    expect(next.consecutiveLowerCount).toBe(0);
  });
});

describe('RiskEvaluator.applyTransition — 하강 연속 3회', () => {
  it('does not demote on a single lower observation', () => {
    const evaluator = new RiskEvaluator();
    const prev: RiskState = {
      ...createInitialRiskState(),
      current: '고위험',
      highRiskTriggered: true,
    };
    const next = evaluator.applyTransition(prev, '저위험');
    expect(next.current).toBe('고위험');
    expect(next.consecutiveLowerCount).toBe(1);
    expect(next.highRiskTriggered).toBe(true);
  });

  it('does not demote at 2 consecutive lower observations', () => {
    const evaluator = new RiskEvaluator();
    let state: RiskState = {
      ...createInitialRiskState(),
      current: '고위험',
      highRiskTriggered: true,
    };
    state = evaluator.applyTransition(state, '저위험');
    state = evaluator.applyTransition(state, '저위험');
    expect(state.current).toBe('고위험');
    expect(state.consecutiveLowerCount).toBe(2);
  });

  it('demotes on the 3rd consecutive lower observation', () => {
    const evaluator = new RiskEvaluator();
    let state: RiskState = {
      ...createInitialRiskState(),
      current: '고위험',
      highRiskTriggered: true,
    };
    for (let i = 0; i < DOWNWARD_TRANSITION_THRESHOLD; i += 1) {
      state = evaluator.applyTransition(state, '저위험');
    }
    expect(state.current).toBe('저위험');
    expect(state.consecutiveLowerCount).toBe(0);
    expect(state.highRiskTriggered).toBe(true);
  });

  it('a single upward observation cancels the downward streak', () => {
    const evaluator = new RiskEvaluator();
    let state: RiskState = {
      ...createInitialRiskState(),
      current: '고위험',
      highRiskTriggered: true,
    };
    state = evaluator.applyTransition(state, '저위험');
    state = evaluator.applyTransition(state, '저위험');
    state = evaluator.applyTransition(state, '고위험');
    state = evaluator.applyTransition(state, '저위험');
    state = evaluator.applyTransition(state, '저위험');
    expect(state.current).toBe('고위험');
    expect(state.consecutiveLowerCount).toBe(2);
  });
});

describe('RiskEvaluator.evaluateUtterance — perSignal snapshot 보존', () => {
  it('updates perSignal with latest level and timestamp for each signal', () => {
    const fixedClock = new Date('2025-02-03T04:05:06Z');
    const evaluator = new RiskEvaluator(undefined, () => fixedClock);
    evaluator.registerSignal(new FixedSignal('keyword', '저위험'));
    evaluator.registerSignal(new FixedSignal('emotion_score', '중위험'));

    const prev = createInitialRiskState(new Date('2025-01-01T00:00:00Z'));
    const { nextState } = evaluator.evaluateUtterance(inputOf('x'), prev);

    expect(nextState.perSignal).toEqual([
      {
        signalId: 'emotion_score',
        level: '중위험',
        evaluatedAt: fixedClock,
      },
      {
        signalId: 'keyword',
        level: '저위험',
        evaluatedAt: fixedClock,
      },
    ]);
    expect(nextState.lastEvaluatedAt).toBe(fixedClock);
  });

  it('preserves snapshots for signals that were not evaluated this turn', () => {
    const fixedClock = new Date('2025-02-03T04:05:06Z');
    const evaluator = new RiskEvaluator(undefined, () => fixedClock);
    evaluator.registerSignal(new FixedSignal('keyword', '저위험'));

    const previousSnap = {
      signalId: 'phase2_prosody',
      level: '중위험' as const,
      evaluatedAt: new Date('2025-01-01T00:00:00Z'),
    };
    const prev: RiskState = {
      ...createInitialRiskState(),
      perSignal: [previousSnap],
    };

    const { nextState } = evaluator.evaluateUtterance(inputOf('x'), prev);

    expect(nextState.perSignal).toContainEqual(previousSnap);
    expect(nextState.perSignal).toContainEqual({
      signalId: 'keyword',
      level: '저위험',
      evaluatedAt: fixedClock,
    });
  });

  it('serializes perSignal deterministically for Redis (정렬 + 일관 직렬화)', () => {
    const fixedClock = new Date('2025-02-03T04:05:06Z');
    const evaluator = new RiskEvaluator(undefined, () => fixedClock);
    evaluator.registerSignal(new FixedSignal('keyword', '저위험'));
    evaluator.registerSignal(new FixedSignal('emotion_score', '저위험'));

    const prev = createInitialRiskState(new Date('2025-01-01T00:00:00Z'));
    const { nextState } = evaluator.evaluateUtterance(inputOf('x'), prev);

    const serialized = JSON.stringify(nextState.perSignal);
    const { nextState: again } = evaluator.evaluateUtterance(
      inputOf('y'),
      prev,
    );
    expect(JSON.stringify(again.perSignal)).toBe(serialized);
  });
});

describe('createMvpRiskEvaluator', () => {
  it('registers KeywordSignal, EmotionScoreSignal and SuicidalityModelSignal', () => {
    const lookup = new StubKeywordLookup(['죽고싶다']);
    const { evaluator, keywordSignal, emotionScoreSignal, suicidalityModelSignal } =
      createMvpRiskEvaluator(lookup);
    expect(evaluator.registeredSignalIds).toEqual([
      'keyword',
      'emotion_score',
      'suicidality_model',
    ]);
    expect(keywordSignal).toBeInstanceOf(KeywordSignal);
    expect(emotionScoreSignal).toBeInstanceOf(EmotionScoreSignal);
    expect(suicidalityModelSignal).toBeInstanceOf(SuicidalityModelSignal);
  });

  it('combines keyword 고위험 with low emotion score → 고위험', async () => {
    const lookup = new StubKeywordLookup(['죽고싶다']);
    const { evaluator, keywordSignal } = createMvpRiskEvaluator(lookup);
    await keywordSignal.refresh();

    const prev = createInitialRiskState();
    const { latest, nextState } = evaluator.evaluateUtterance(
      inputOf('죽고싶다', { 불안: 1, 분노: 1 }),
      prev,
    );
    expect(latest.combinedLevel).toBe('고위험');
    expect(nextState.current).toBe('고위험');
    expect(nextState.highRiskTriggered).toBe(true);
  });

  it('combines benign keywords with high emotion score → 고위험 (감정 신호 단독)', async () => {
    const lookup = new StubKeywordLookup(['죽고싶다']);
    const { evaluator, keywordSignal } = createMvpRiskEvaluator(lookup);
    await keywordSignal.refresh();

    const prev = createInitialRiskState();
    const { latest } = evaluator.evaluateUtterance(
      inputOf('오늘 좀 답답해', { 불안: 9 }),
      prev,
    );
    expect(latest.combinedLevel).toBe('고위험');
  });

  it('returns 저위험 when no signal triggers', async () => {
    const lookup = new StubKeywordLookup(['죽고싶다']);
    const { evaluator, keywordSignal } = createMvpRiskEvaluator(lookup);
    await keywordSignal.refresh();

    const prev = createInitialRiskState();
    const { latest } = evaluator.evaluateUtterance(
      inputOf('오늘 산책했어', { 불안: 3, 분노: 2 }),
      prev,
    );
    expect(latest.combinedLevel).toBe('저위험');
  });
});
