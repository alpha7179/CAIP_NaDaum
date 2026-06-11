// `ChannelCalibrator` 단위 테스트


import type { ChannelResult, EmotionScores } from '@nadaum/shared';
import { EMOTION_CATEGORIES } from '@nadaum/shared';
import { describe, expect, it } from 'vitest';

import { DefaultChannelCalibrator } from './ChannelCalibrator.js';

function scores(values: Partial<EmotionScores>): EmotionScores {  return {
    기쁨: values.기쁨 ?? 5,
    슬픔: values.슬픔 ?? 5,
    분노: values.분노 ?? 5,
    불안: values.불안 ?? 5,
    놀람: values.놀람 ?? 5,
    혐오: values.혐오 ?? 5,
    중립: values.중립 ?? 5,
  };
}

function makeResult(
  channelId: string,
  partialScores: Partial<EmotionScores>,
  confidence = 0.8,
): ChannelResult {
  return {
    channelId,
    scores: scores(partialScores),
    confidence,
    meta: { latencyMs: 100, modelVersion: 'test-v1' },
  };
}

function expectAllScoresInDomain(s: EmotionScores): void {
  for (const category of EMOTION_CATEGORIES) {
    const value = s[category];
    expect(Number.isInteger(value)).toBe(true);
    expect(value).toBeGreaterThanOrEqual(1);
    expect(value).toBeLessThanOrEqual(10);
  }
}

describe('DefaultChannelCalibrator', () => {
  const calibrator = new DefaultChannelCalibrator();

  describe("policy: 'text_only'", () => {
    it('텍스트 채널 결과를 그대로 반환한다', () => {
      const text = makeResult('text', { 기쁨: 7, 슬픔: 2, 분노: 3 });
      const result = calibrator.combine([text], 'text_only');

      expect(result.combinedScores.기쁨).toBe(7);
      expect(result.combinedScores.슬픔).toBe(2);
      expect(result.combinedScores.분노).toBe(3);
      expect(result.policy).toBe('text_only');
      expect(result.missingChannels).toEqual([]);
      expect(result.perChannel).toHaveLength(1);
    });

    it('텍스트 채널이 누락되면 missingChannels에 "text"를 자동 추가한다', () => {
      const voice = makeResult('voice_prosody', { 기쁨: 9 });
      const result = calibrator.combine([voice], 'text_only');

      expect(result.missingChannels).toContain('text');
      expectAllScoresInDomain(result.combinedScores);
    });

    it('호출자가 명시한 missingChannelIds를 보존한다', () => {
      const text = makeResult('text', { 기쁨: 6 });
      const result = calibrator.combine([text], 'text_only', {
        missingChannelIds: ['voice_prosody'],
      });

      expect(result.missingChannels).toContain('voice_prosody');
      expect(result.missingChannels).not.toContain('text');
    });
  });

  describe("policy: 'max'", () => {
    it('각 감정마다 채널 간 최댓값을 채택한다', () => {
      const a = makeResult('text', { 기쁨: 3, 슬픔: 8, 분노: 2 });
      const b = makeResult('voice_prosody', { 기쁨: 7, 슬픔: 4, 분노: 6 });
      const result = calibrator.combine([a, b], 'max');

      expect(result.combinedScores.기쁨).toBe(7);
      expect(result.combinedScores.슬픔).toBe(8);
      expect(result.combinedScores.분노).toBe(6);
      expectAllScoresInDomain(result.combinedScores);
    });

    it('범위를 벗어난 점수도 1-10으로 클램프된다', () => {
      const a = makeResult('text', { 기쁨: 99, 슬픔: -5 });
      const result = calibrator.combine([a], 'max');

      expect(result.combinedScores.기쁨).toBe(10);
      expect(result.combinedScores.슬픔).toBe(1);
      expectAllScoresInDomain(result.combinedScores);
    });

    it('0개 채널 입력에서도 도메인이 보존된다', () => {
      const result = calibrator.combine([], 'max');
      expectAllScoresInDomain(result.combinedScores);
      expect(result.perChannel).toEqual([]);
    });
  });

  describe("policy: 'weighted_avg'", () => {
    it('confidence를 가중치로 가중 평균을 산출한다', () => {
      const high = makeResult('text', { 기쁨: 8 }, 1.0);
      const low = makeResult('voice_prosody', { 기쁨: 2 }, 0.0);
      const result = calibrator.combine([high, low], 'weighted_avg');

      expect(result.combinedScores.기쁨).toBe(8);
    });

    it('동일 신뢰도일 때는 산술 평균과 동등하다', () => {
      const a = makeResult('text', { 기쁨: 4 }, 0.5);
      const b = makeResult('voice_prosody', { 기쁨: 8 }, 0.5);
      const result = calibrator.combine([a, b], 'weighted_avg');

      expect(result.combinedScores.기쁨).toBe(6);
      expectAllScoresInDomain(result.combinedScores);
    });

    it('모든 신뢰도가 0이면 산술 평균으로 폴백한다', () => {
      const a = makeResult('text', { 기쁨: 3 }, 0);
      const b = makeResult('voice_prosody', { 기쁨: 7 }, 0);
      const result = calibrator.combine([a, b], 'weighted_avg');

      expect(result.combinedScores.기쁨).toBe(5);
      expectAllScoresInDomain(result.combinedScores);
    });
  });

  describe('도메인 보존 — 정책 전반', () => {
    it.each(['text_only', 'max', 'weighted_avg'] as const)(
      "'%s' 정책에서도 결과 7가지 점수는 모두 1-10 정수다",
      (policy) => {
        const a = makeResult('text', { 기쁨: 11.7, 슬픔: -3, 분노: 5.5 }, 0.7);
        const b = makeResult('voice_prosody', { 기쁨: 4, 슬픔: 9.4, 분노: 0 }, 0.3);
        const result = calibrator.combine([a, b], policy);
        expectAllScoresInDomain(result.combinedScores);
      },
    );
  });

  describe('missingChannels 전파', () => {
    it('호출자가 명시한 누락 채널 ID를 결과에 포함한다', () => {
      const text = makeResult('text', { 기쁨: 6 });
      const result = calibrator.combine([text], 'max', {
        missingChannelIds: ['voice_prosody', 'self_finetuned_backup'],
      });
      expect(result.missingChannels).toContain('voice_prosody');
      expect(result.missingChannels).toContain('self_finetuned_backup');
    });

    it('누락 채널 명시가 없으면 빈 배열이다 (text_only 외 정책)', () => {
      const text = makeResult('text', { 기쁨: 6 });
      const result = calibrator.combine([text], 'max');
      expect(result.missingChannels).toEqual([]);
    });
  });

  describe('불변성', () => {
    it('입력 결과 배열을 변형하지 않는다', () => {
      const text = makeResult('text', { 기쁨: 6 });
      const input: ChannelResult[] = [text];
      const snapshot = [...input];
      calibrator.combine(input, 'max');
      expect(input).toEqual(snapshot);
    });
  });
});
