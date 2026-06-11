// 위험 평가 도메인 공유 타입
export type RiskLevel = '저위험' | '중위험' | '고위험';

export const RISK_LEVELS = ['저위험', '중위험', '고위험'] as const satisfies ReadonlyArray<RiskLevel>;

// 위험 신호별 마지막 평가 결과
export interface RiskSignalSnapshot {
  signalId: string;
  level: RiskLevel;
  evaluatedAt: Date;
}

// 활성 세션의 누적 위험 상태
export interface RiskState {
  current: RiskLevel;
  consecutiveLowerCount: number;
  lastEvaluatedAt: Date;
  highRiskTriggered: boolean;
  perSignal: RiskSignalSnapshot[];
}
