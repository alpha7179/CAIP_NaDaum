// EmotionScoreSignal 단위 테스트

import type { EmotionScores } from '@nadaum/shared';
import { describe, expect, it } from 'vitest';


import { EmotionScoreSignal } from './EmotionScoreSignal.js';
import type { RiskInput } from './RiskSignal.js';

function makeScores(overrides: Partial<EmotionScores> = {}): EmotionScores {
  return {
    기쁨: 1,
    슬픔: 1,
    분노: 1,
    불안: 1,
    놀람: 1,
    혐오: 1,
    중립: 5,
    ...overrides,
  };
}

function makeInput(scoreOverrides: Partial<EmotionScores> = {}): RiskInput {
  return {
    text: '',
    emotionScores: makeScores(scoreOverrides),
  };
}

describe('EmotionScoreSignal', () => {
  const signal = new EmotionScoreSignal();

  it('signalId가 emotion_score이다', () => {
    expect(signal.signalId).toBe('emotion_score');
  });

  describe('고위험 분류 (불안/분노 ≥ 9)', () => {
    it('불안 = 9이면 고위험', () => {
      expect(signal.evaluate(makeInput({ 불안: 9 }))).toBe('고위험');
    });

    it('분노 = 9이면 고위험', () => {
      expect(signal.evaluate(makeInput({ 분노: 9 }))).toBe('고위험');
    });

    it('불안 = 10이면 고위험', () => {
      expect(signal.evaluate(makeInput({ 불안: 10 }))).toBe('고위험');
    });

    it('분노 = 10이면 고위험', () => {
      expect(signal.evaluate(makeInput({ 분노: 10 }))).toBe('고위험');
    });

    it('불안 9 + 분노 9이면 고위험 (다른 감정과 무관)', () => {
      expect(
        signal.evaluate(
          makeInput({ 불안: 9, 분노: 9, 슬픔: 10, 혐오: 10 }),
        ),
      ).toBe('고위험');
    });
  });

  describe('중위험 분류 (불안/분노 = 8)', () => {
    it('불안 = 8이면 중위험', () => {
      expect(signal.evaluate(makeInput({ 불안: 8 }))).toBe('중위험');
    });

    it('분노 = 8이면 중위험', () => {
      expect(signal.evaluate(makeInput({ 분노: 8 }))).toBe('중위험');
    });

    it('불안 = 8, 분노 = 8이면 중위험', () => {
      expect(signal.evaluate(makeInput({ 불안: 8, 분노: 8 }))).toBe('중위험');
    });

    it('불안 = 8이고 다른 감정이 10이어도 중위험 (불안/분노 외는 무시)', () => {
      expect(
        signal.evaluate(makeInput({ 불안: 8, 슬픔: 10, 혐오: 10 })),
      ).toBe('중위험');
    });
  });

  describe('저위험 분류', () => {
    it('불안 = 7, 분노 = 7이면 저위험', () => {
      expect(signal.evaluate(makeInput({ 불안: 7, 분노: 7 }))).toBe('저위험');
    });

    it('불안/분노 모두 1이면 저위험', () => {
      expect(signal.evaluate(makeInput({ 불안: 1, 분노: 1 }))).toBe('저위험');
    });

    it('슬픔/혐오가 10이어도 불안/분노가 7 이하면 저위험', () => {
      expect(
        signal.evaluate(
          makeInput({ 불안: 7, 분노: 7, 슬픔: 10, 혐오: 10, 기쁨: 1 }),
        ),
      ).toBe('저위험');
    });
  });

  describe('경계 동작', () => {
    it('불안 7 → 저위험, 불안 8 → 중위험, 불안 9 → 고위험으로 단조 증가', () => {
      const at7 = signal.evaluate(makeInput({ 불안: 7 }));
      const at8 = signal.evaluate(makeInput({ 불안: 8 }));
      const at9 = signal.evaluate(makeInput({ 불안: 9 }));
      expect(at7).toBe('저위험');
      expect(at8).toBe('중위험');
      expect(at9).toBe('고위험');
    });

    it('분노 7 → 저위험, 분노 8 → 중위험, 분노 9 → 고위험으로 단조 증가', () => {
      const at7 = signal.evaluate(makeInput({ 분노: 7 }));
      const at8 = signal.evaluate(makeInput({ 분노: 8 }));
      const at9 = signal.evaluate(makeInput({ 분노: 9 }));
      expect(at7).toBe('저위험');
      expect(at8).toBe('중위험');
      expect(at9).toBe('고위험');
    });

    it('불안 = 8, 분노 = 9이면 고위험이 우선 (둘 중 하나만 ≥9면 고위험)', () => {
      expect(signal.evaluate(makeInput({ 불안: 8, 분노: 9 }))).toBe('고위험');
    });

    it('불안 = 9, 분노 = 8이면 고위험이 우선', () => {
      expect(signal.evaluate(makeInput({ 불안: 9, 분노: 8 }))).toBe('고위험');
    });
  });
});
