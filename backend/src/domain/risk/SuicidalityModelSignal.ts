// LLM 기반 위험도 분류 신호

import type { RiskLevel } from '@nadaum/shared';

import type { RiskInput, RiskSignal } from './RiskSignal.js';

export const SUICIDALITY_MODEL_OUTPUT_KEY = 'suicidality_model';

// LLM 위험 분류 결과
export interface SuicidalityModelOutput {
  readonly level?: RiskLevel;
  readonly score?: number;
}

// 비동기 위험 평가 포트 — 외부 LLM 위험 분류기 추상화
export interface RiskModelAssessor {
  assess(text: string): Promise<SuicidalityModelOutput | undefined>;
}

const HIGH_SCORE_THRESHOLD = 0.8;
const MEDIUM_SCORE_THRESHOLD = 0.5;

const VALID_LEVELS: ReadonlySet<RiskLevel> = new Set<RiskLevel>([
  '저위험',
  '중위험',
  '고위험',
]);

function levelFromScore(score: number): RiskLevel {
  if (score >= HIGH_SCORE_THRESHOLD) {
    return '고위험';
  }
  if (score >= MEDIUM_SCORE_THRESHOLD) {
    return '중위험';
  }
  return '저위험';
}

export class SuicidalityModelSignal implements RiskSignal {
  public readonly signalId = 'suicidality_model' as const;

  public evaluate(input: RiskInput): RiskLevel {
    const raw = input.modelOutputs?.[SUICIDALITY_MODEL_OUTPUT_KEY];
    if (typeof raw !== 'object' || raw === null) {
      return '저위험';
    }
    const out = raw as SuicidalityModelOutput;
    if (typeof out.level === 'string' && VALID_LEVELS.has(out.level)) {
      return out.level;
    }
    if (typeof out.score === 'number' && Number.isFinite(out.score)) {
      const clamped = out.score < 0 ? 0 : out.score > 1 ? 1 : out.score;
      return levelFromScore(clamped);
    }
    return '저위험';
  }
}
