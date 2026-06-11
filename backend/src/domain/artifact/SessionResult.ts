// SessionResult 정규화 모델과 변환 함수

import type {
  CalibratedEmotion,
  ChannelResult,
  CognitiveDistortion,
  EmotionAnalysisResult,
  RiskTrajectoryPoint,
  SessionContext,
  SessionResult,
} from '@nadaum/shared';
import { COGNITIVE_DISTORTIONS } from '@nadaum/shared';

export type { SessionResult, RiskTrajectoryPoint } from '@nadaum/shared';

export function fromSessionContext(
  context: SessionContext,
  riskTrajectory: RiskTrajectoryPoint[],
  endedAt: Date,
): SessionResult {
  const cumulativeEmotion: CalibratedEmotion = buildCalibratedEmotion(context);
  const distortions: CognitiveDistortion[] = aggregateDistortions(
    context.cumulativeEmotion.utteranceScores,
  );

  return {
    sessionId: context.sessionId,
    userId: context.userId,
    exchanges: [...context.exchanges],
    cumulativeEmotion,
    distortions,
    riskTrajectory: [...riskTrajectory],
    endedAt,
  };
}

function buildCalibratedEmotion(context: SessionContext): CalibratedEmotion {
  const utteranceScores = context.cumulativeEmotion.utteranceScores;
  const latest: EmotionAnalysisResult | undefined =
    utteranceScores.length > 0
      ? utteranceScores[utteranceScores.length - 1]
      : undefined;

  const perChannel: ChannelResult[] =
    latest !== undefined ? [latestToTextChannelResult(latest)] : [];

  return {
    combinedScores: { ...context.cumulativeEmotion.aggregate },
    perChannel,
    missingChannels: [],
    policy: 'text_only',
  };
}

function latestToTextChannelResult(
  latest: EmotionAnalysisResult,
): ChannelResult {
  return {
    channelId: 'text',
    scores: { ...latest.scores },
    distortions: [...latest.distortions],
    confidence: 1,
    meta: {
      latencyMs: 0,
      modelVersion: 'unknown',
    },
  };
}

function aggregateDistortions(
  utteranceScores: ReadonlyArray<EmotionAnalysisResult>,
): CognitiveDistortion[] {
  const seen = new Set<CognitiveDistortion>();
  for (const result of utteranceScores) {
    for (const distortion of result.distortions) {
      if (isCognitiveDistortion(distortion)) {
        seen.add(distortion);
      }
    }
  }
  return COGNITIVE_DISTORTIONS.filter((d) => seen.has(d));
}

function isCognitiveDistortion(value: string): value is CognitiveDistortion {
  return (COGNITIVE_DISTORTIONS as ReadonlyArray<string>).includes(value);
}
