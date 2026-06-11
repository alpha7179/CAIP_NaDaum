// RiskDecisionFunction 단위 테스트
import type { RiskLevel } from '@nadaum/shared';
import { describe, expect, it } from 'vitest';


import {
  decide,
  defaultRiskDecisionFunction,
  maxRiskLevel,
} from './RiskDecisionFunction.js';

function s(signalId: string, level: RiskLevel) {
  return { signalId, level };
}

describe('RiskDecisionFunction.decide', () => {
  it('returns "저위험" when no signals are registered', () => {
    expect(decide([])).toBe('저위험');
  });

  it('returns the only signal level when one signal is present', () => {
    expect(decide([s('keyword', '저위험')])).toBe('저위험');
    expect(decide([s('keyword', '중위험')])).toBe('중위험');
    expect(decide([s('keyword', '고위험')])).toBe('고위험');
  });

  it('selects the maximum level across multiple signals (저 < 중 < 고)', () => {
    expect(
      decide([s('keyword', '저위험'), s('emotion_score', '중위험')]),
    ).toBe('중위험');
    expect(
      decide([s('keyword', '저위험'), s('emotion_score', '고위험')]),
    ).toBe('고위험');
    expect(
      decide([s('keyword', '중위험'), s('emotion_score', '고위험')]),
    ).toBe('고위험');
  });

  it('keyword signal "고위험" overrides emotion score "저위험"', () => {
    expect(
      decide([s('keyword', '고위험'), s('emotion_score', '저위험')]),
    ).toBe('고위험');
  });

  it('returns the same level when all signals agree', () => {
    expect(
      decide([
        s('a', '중위험'),
        s('b', '중위험'),
        s('c', '중위험'),
      ]),
    ).toBe('중위험');
  });

  it('is order-independent', () => {
    const ordered = decide([
      s('a', '저위험'),
      s('b', '중위험'),
      s('c', '고위험'),
    ]);
    const reversed = decide([
      s('c', '고위험'),
      s('b', '중위험'),
      s('a', '저위험'),
    ]);
    expect(ordered).toBe(reversed);
  });

  it('exposes the same decide via defaultRiskDecisionFunction', () => {
    expect(
      defaultRiskDecisionFunction.decide([s('x', '고위험')]),
    ).toBe('고위험');
  });
});

describe('maxRiskLevel', () => {
  it('returns the higher of two risk levels', () => {
    expect(maxRiskLevel('저위험', '저위험')).toBe('저위험');
    expect(maxRiskLevel('저위험', '중위험')).toBe('중위험');
    expect(maxRiskLevel('중위험', '저위험')).toBe('중위험');
    expect(maxRiskLevel('중위험', '고위험')).toBe('고위험');
    expect(maxRiskLevel('고위험', '저위험')).toBe('고위험');
  });
});
