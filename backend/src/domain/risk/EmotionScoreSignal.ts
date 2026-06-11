// 감정 점수 임계 기반 위험 신호

import type { RiskLevel } from '@nadaum/shared';

import type { RiskInput, RiskSignal } from './RiskSignal.js';

const HIGH_RISK_THRESHOLD = 9;

const MEDIUM_RISK_THRESHOLD = 8;

export class EmotionScoreSignal implements RiskSignal {
  readonly signalId = 'emotion_score';

  evaluate(input: RiskInput): RiskLevel {
    const { 불안, 분노 } = input.emotionScores;

    if (불안 >= HIGH_RISK_THRESHOLD || 분노 >= HIGH_RISK_THRESHOLD) {
      return '고위험';
    }

    if (불안 >= MEDIUM_RISK_THRESHOLD || 분노 >= MEDIUM_RISK_THRESHOLD) {
      return '중위험';
    }

    return '저위험';
  }
}
