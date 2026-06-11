// 속성 테스트: 위험 전이의 비대칭성
import { RISK_LEVELS, type RiskLevel, type RiskState } from '@nadaum/shared';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';


import { DOWNWARD_TRANSITION_THRESHOLD, RiskEvaluator } from './RiskEvaluator.js';

const WEIGHT: Record<RiskLevel, number> = { 저위험: 0, 중위험: 1, 고위험: 2 };

const levelArb = fc.constantFrom<RiskLevel>(...RISK_LEVELS);

function stateArb(): fc.Arbitrary<RiskState> {
  return fc.record({
    current: levelArb,
    consecutiveLowerCount: fc.integer({ min: 0, max: 5 }),
    lastEvaluatedAt: fc.constant(new Date('2026-05-28T00:00:00.000Z')),
    highRiskTriggered: fc.boolean(),
    perSignal: fc.constant([]),
  });
}

const evaluator = new RiskEvaluator();

describe('위험 전이의 비대칭성', () => {
  it('upgrades immediately and resets the lower counter', () => {
    fc.assert(
      fc.property(stateArb(), levelArb, (prev, latest) => {
        fc.pre(WEIGHT[latest] > WEIGHT[prev.current]);
        const next = evaluator.applyTransition(prev, latest);
        expect(next.current).toBe(latest);
        expect(next.consecutiveLowerCount).toBe(0);
      }),
    );
  });

  it('keeps the level and resets the counter on equal level', () => {
    fc.assert(
      fc.property(stateArb(), (prev) => {
        const next = evaluator.applyTransition(prev, prev.current);
        expect(next.current).toBe(prev.current);
        expect(next.consecutiveLowerCount).toBe(0);
      }),
    );
  });

  it('does not downgrade until the threshold of consecutive lower readings', () => {
    fc.assert(
      fc.property(stateArb(), levelArb, (prev, latest) => {
        fc.pre(WEIGHT[latest] < WEIGHT[prev.current]);
        const next = evaluator.applyTransition(prev, latest);
        if (prev.consecutiveLowerCount + 1 >= DOWNWARD_TRANSITION_THRESHOLD) {
          expect(next.current).toBe(latest);
          expect(next.consecutiveLowerCount).toBe(0);
        } else {
          expect(next.current).toBe(prev.current);
          expect(next.consecutiveLowerCount).toBe(prev.consecutiveLowerCount + 1);
        }
      }),
    );
  });

  it('requires exactly 3 consecutive lower readings to drop one level (concrete trace)', () => {
    let state: RiskState = {
      current: '고위험',
      consecutiveLowerCount: 0,
      lastEvaluatedAt: new Date(),
      highRiskTriggered: true,
      perSignal: [],
    };
    state = evaluator.applyTransition(state, '저위험');
    expect(state.current).toBe('고위험');
    state = evaluator.applyTransition(state, '저위험');
    expect(state.current).toBe('고위험');
    state = evaluator.applyTransition(state, '저위험');
    expect(state.current).toBe('저위험');
  });
});
