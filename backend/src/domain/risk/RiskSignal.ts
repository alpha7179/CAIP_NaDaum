// 위험 평가 도메인 공유 타입 — RiskSignal 인터페이스 및 입력 타입

import type { EmotionScores, RiskLevel } from '@nadaum/shared';

// 단일 사용자 발화에 대한 위험 평가 입력
export interface RiskInput {
  readonly text: string;
  readonly emotionScores: EmotionScores;
  readonly audioFeatures?: unknown;
  readonly modelOutputs?: Record<string, unknown>;
}

// 위험 신호 인터페이스
export interface RiskSignal {
  readonly signalId: string;
  evaluate(input: RiskInput): RiskLevel;
}

export type { RiskLevel } from '@nadaum/shared';
