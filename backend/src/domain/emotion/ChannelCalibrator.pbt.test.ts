// 속성 테스트: 감정 점수 도메인 보존
import {
  EMOTION_CATEGORIES,
  type CalibrationPolicy,
  type ChannelResult,
  type EmotionScores,
} from '@nadaum/shared';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';


import { DefaultChannelCalibrator } from './ChannelCalibrator.js';

const calibrator = new DefaultChannelCalibrator();

const scoreValueArb = fc.oneof(
  fc.double({ min: -50, max: 50, noNaN: true }),
  fc.constantFrom(Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 0, 11, -3),
);

function scoresArb(): fc.Arbitrary<EmotionScores> {
  return fc.record({
    기쁨: scoreValueArb,
    슬픔: scoreValueArb,
    분노: scoreValueArb,
    불안: scoreValueArb,
    놀람: scoreValueArb,
    혐오: scoreValueArb,
    중립: scoreValueArb,
  });
}

function channelResultArb(): fc.Arbitrary<ChannelResult> {
  return fc.record({
    channelId: fc.constantFrom('text', 'voice_prosody', 'backup'),
    scores: scoresArb(),
    distortions: fc.constant([]),
    confidence: fc.double({ min: 0, max: 1, noNaN: true }),
    meta: fc.record({
      latencyMs: fc.constant(0),
      modelVersion: fc.constant('pbt'),
    }),
  });
}

const policyArb = fc.constantFrom<CalibrationPolicy>('text_only', 'max', 'weighted_avg');

function assertDomainPreserved(scores: EmotionScores): void {
  for (const category of EMOTION_CATEGORIES) {
    const v = scores[category];
    expect(Number.isInteger(v)).toBe(true);
    expect(v).toBeGreaterThanOrEqual(1);
    expect(v).toBeLessThanOrEqual(10);
  }
}

describe('감정 점수 도메인 보존', () => {
  it('produces 7 integer scores in [1,10] for 0/1/many channels across all policies', () => {
    fc.assert(
      fc.property(
        fc.array(channelResultArb(), { minLength: 0, maxLength: 5 }),
        policyArb,
        (results, policy) => {
          const result = calibrator.combine(results, policy);
          assertDomainPreserved(result.combinedScores);
        },
      ),
    );
  });

  it('preserves the domain even with empty input', () => {
    for (const policy of ['text_only', 'max', 'weighted_avg'] as const) {
      assertDomainPreserved(calibrator.combine([], policy).combinedScores);
    }
  });
});
