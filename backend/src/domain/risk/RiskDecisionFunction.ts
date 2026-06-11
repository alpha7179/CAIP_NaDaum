// 더 높은 위험 우선 정책 결정 함수

import type { RiskLevel } from '@nadaum/shared';

const RISK_WEIGHT: Readonly<Record<RiskLevel, number>> = Object.freeze({
  저위험: 0,
  중위험: 1,
  고위험: 2,
});

export function maxRiskLevel(a: RiskLevel, b: RiskLevel): RiskLevel {
  return RISK_WEIGHT[a] >= RISK_WEIGHT[b] ? a : b;
}

export function decide(
  signals: ReadonlyArray<{ signalId: string; level: RiskLevel }>,
): RiskLevel {
  let max: RiskLevel = '저위험';
  for (const s of signals) {
    if (RISK_WEIGHT[s.level] > RISK_WEIGHT[max]) {
      max = s.level;
    }
  }
  return max;
}

// 함수형 인터페이스 형태로도 노출
export interface RiskDecisionFunction {
  decide(signals: ReadonlyArray<{ signalId: string; level: RiskLevel }>): RiskLevel;
}

export const defaultRiskDecisionFunction: RiskDecisionFunction = { decide };
