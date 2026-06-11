// `ChannelCalibrator` — 다중 감정 채널 결과를 정책별로 통합하는 도메인 함수

import type {
  CalibratedEmotion,
  CalibrationPolicy,
  ChannelResult,
  EmotionScores,
} from '@nadaum/shared';
import { EMOTION_CATEGORIES } from '@nadaum/shared';

const SCORE_MIN = 1;
const SCORE_MAX = 10;
const NEUTRAL_DEFAULT = 5;

const TEXT_CHANNEL_ID = 'text';

function clampRound(value: number): number {
  if (!Number.isFinite(value)) {
    return NEUTRAL_DEFAULT;
  }
  const rounded = Math.round(value);
  if (rounded < SCORE_MIN) {
    return SCORE_MIN;
  }
  if (rounded > SCORE_MAX) {
    return SCORE_MAX;
  }
  return rounded;
}

function normalizeScores(scores: EmotionScores): EmotionScores {
  return {
    기쁨: clampRound(scores.기쁨),
    슬픔: clampRound(scores.슬픔),
    분노: clampRound(scores.분노),
    불안: clampRound(scores.불안),
    놀람: clampRound(scores.놀람),
    혐오: clampRound(scores.혐오),
    중립: clampRound(scores.중립),
  };
}

function defaultNeutralScores(): EmotionScores {
  return {
    기쁨: NEUTRAL_DEFAULT,
    슬픔: NEUTRAL_DEFAULT,
    분노: NEUTRAL_DEFAULT,
    불안: NEUTRAL_DEFAULT,
    놀람: NEUTRAL_DEFAULT,
    혐오: NEUTRAL_DEFAULT,
    중립: NEUTRAL_DEFAULT,
  };
}

function combineByMax(results: readonly ChannelResult[]): EmotionScores {
  if (results.length === 0) {
    return defaultNeutralScores();
  }
  const out = defaultNeutralScores();
  for (const category of EMOTION_CATEGORIES) {
    let max = Number.NEGATIVE_INFINITY;
    for (const result of results) {
      const value = result.scores[category];
      if (Number.isFinite(value) && value > max) {
        max = value;
      }
    }
    if (Number.isFinite(max)) {
      out[category] = clampRound(max);
    }
  }
  return out;
}

function combineByWeightedAvg(results: readonly ChannelResult[]): EmotionScores {
  if (results.length === 0) {
    return defaultNeutralScores();
  }
  const out = defaultNeutralScores();
  const weights = results.map((r) =>
    Number.isFinite(r.confidence) && r.confidence > 0 ? r.confidence : 0,
  );  const totalWeight = weights.reduce((a, b) => a + b, 0);

  for (const category of EMOTION_CATEGORIES) {
    let weightedSum = 0;
    let arithmeticSum = 0;
    let validCount = 0;
    for (let i = 0; i < results.length; i += 1) {
      const result = results[i] as ChannelResult;
      const weight = weights[i] as number;
      const value = result.scores[category];
      if (!Number.isFinite(value)) {
        continue;
      }
      weightedSum += value * weight;
      arithmeticSum += value;
      validCount += 1;
    }
    let combined: number;
    if (totalWeight > 0) {
      combined = weightedSum / totalWeight;
    } else if (validCount > 0) {
      combined = arithmeticSum / validCount;
    } else {
      combined = NEUTRAL_DEFAULT;
    }
    out[category] = clampRound(combined);
  }
  return out;
}

function combineByTextOnly(results: readonly ChannelResult[]): {
  scores: EmotionScores;
  textPresent: boolean;
} {
  const textResult = results.find((r) => r.channelId === TEXT_CHANNEL_ID);
  if (!textResult) {
    return { scores: defaultNeutralScores(), textPresent: false };
  }
  return { scores: normalizeScores(textResult.scores), textPresent: true };
}

// `combine` 호출 옵션. 누락 채널 ID를 호출자가 명시 가능.
export interface CombineOptions {
  readonly missingChannelIds?: readonly string[];
}

// `ChannelCalibrator` 도메인 인터페이스.
export interface ChannelCalibrator {
  combine(
    results: readonly ChannelResult[],
    policy: CalibrationPolicy,
    options?: CombineOptions,
  ): CalibratedEmotion;
}

// `ChannelCalibrator`의 기본 구현.
export class DefaultChannelCalibrator implements ChannelCalibrator {
  public combine(
    results: readonly ChannelResult[],
    policy: CalibrationPolicy,
    options?: CombineOptions,
  ): CalibratedEmotion {
    const missing = new Set<string>(options?.missingChannelIds ?? []);

    let combinedScores: EmotionScores;
    switch (policy) {
      case 'text_only': {
        const { scores, textPresent } = combineByTextOnly(results);
        combinedScores = scores;
        if (!textPresent) {
          missing.add(TEXT_CHANNEL_ID);
        }
        break;
      }
      case 'max': {
        combinedScores = combineByMax(results);
        break;
      }
      case 'weighted_avg': {
        combinedScores = combineByWeightedAvg(results);
        break;
      }
      default: {
        combinedScores = combineByMax(results);
        break;
      }
    }

    return {
      combinedScores,
      perChannel: [...results],
      missingChannels: [...missing],
      policy,
    };
  }
}

export const channelCalibrator: ChannelCalibrator = new DefaultChannelCalibrator();
