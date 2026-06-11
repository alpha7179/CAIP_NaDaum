// 속성 테스트: 위험 우선 정책의 단조성
import { RISK_LEVELS, type RiskLevel } from '@nadaum/shared';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';


import { decide } from './RiskDecisionFunction.js';

const WEIGHT: Record<RiskLevel, number> = { 저위험: 0, 중위험: 1, 고위험: 2 };

const levelArb = fc.constantFrom<RiskLevel>(...RISK_LEVELS);
const signalArb = fc.record({
  signalId: fc.string(),
  level: levelArb,
});

describe('위험 우선 정책의 단조성', () => {
  it('decide(S) equals the maximum signal level', () => {
    fc.assert(
      fc.property(fc.array(signalArb), (signals) => {
        const result = decide(signals);
        const expectedWeight = signals.reduce(
          (max, s) => Math.max(max, WEIGHT[s.level]),
          0,
        );
        expect(WEIGHT[result]).toBe(expectedWeight);
      }),
    );
  });

  it('adding any signal never lowers the decision (monotonic non-decreasing)', () => {
    fc.assert(
      fc.property(fc.array(signalArb), signalArb, (base, extra) => {
        const before = decide(base);
        const after = decide([...base, extra]);
        expect(WEIGHT[after]).toBeGreaterThanOrEqual(WEIGHT[before]);
      }),
    );
  });

  it('empty signal set decides 저위험 (conservative default)', () => {
    expect(decide([])).toBe('저위험');
  });
});
