// KeywordSignal 단위 테스트
import type { EmotionScores } from '@nadaum/shared';
import { describe, expect, it } from 'vitest';


import { KeywordSignal, type KeywordLookup } from './KeywordSignal.js';
import type { RiskInput } from './RiskSignal.js';

const baseScores: EmotionScores = {
  기쁨: 5,
  슬픔: 5,
  분노: 5,
  불안: 5,
  놀람: 5,
  혐오: 5,
  중립: 5,
};

function inputOf(text: string): RiskInput {
  return { text, emotionScores: baseScores };
}

class FakeLookup implements KeywordLookup {
  public loadCalls = 0;
  public isHighRiskCalls = 0;
  public constructor(private readonly keywords: ReadonlyArray<string>) {}
  public async loadKeywords(): Promise<ReadonlyArray<string>> {
    this.loadCalls += 1;
    return this.keywords;
  }
  public isHighRisk(text: string): boolean {
    this.isHighRiskCalls += 1;
    return this.keywords.some((kw) => kw.length > 0 && text.includes(kw));
  }
}

describe('KeywordSignal', () => {
  it('signalId equals "keyword"', () => {
    const signal = new KeywordSignal(new FakeLookup([]));
    expect(signal.signalId).toBe('keyword');
  });

  it('returns "저위험" when cache is not loaded (defensive default)', () => {
    const signal = new KeywordSignal(new FakeLookup(['죽고싶다']));
    expect(signal.isLoaded).toBe(false);
    expect(signal.evaluate(inputOf('죽고싶다'))).toBe('저위험');
  });

  it('returns "고위험" after refresh when text contains a seeded keyword', async () => {
    const signal = new KeywordSignal(new FakeLookup(['죽고싶다', '자해']));
    await signal.refresh();
    expect(signal.isLoaded).toBe(true);
    expect(signal.cachedKeywordCount).toBe(2);
    expect(signal.evaluate(inputOf('요즘 너무 힘들어서 죽고싶다'))).toBe('고위험');
    expect(signal.evaluate(inputOf('자해 충동이 심해'))).toBe('고위험');
  });

  it('returns "저위험" when no keyword matches', async () => {
    const signal = new KeywordSignal(new FakeLookup(['자살']));
    await signal.refresh();
    expect(signal.evaluate(inputOf('오늘 날씨가 좋다'))).toBe('저위험');
  });

  it('ignores empty keywords loaded from the adapter', async () => {
    const lookup = new FakeLookup(['', '자해', '']);
    const signal = new KeywordSignal(lookup);
    await signal.refresh();
    expect(signal.cachedKeywordCount).toBe(1);
    expect(signal.evaluate(inputOf(''))).toBe('저위험');
  });

  it('returns "저위험" for empty input text even with loaded keywords', async () => {
    const signal = new KeywordSignal(new FakeLookup(['자해']));
    await signal.refresh();
    expect(signal.evaluate(inputOf(''))).toBe('저위험');
  });

  it('refresh is a no-op when adapter does not implement loadKeywords', async () => {
    const lookup: KeywordLookup = {
      isHighRisk: () => false,
    };
    const signal = new KeywordSignal(lookup);
    await signal.refresh();
    expect(signal.isLoaded).toBe(false);
    expect(signal.cachedKeywordCount).toBe(0);
  });

  it('evaluateAsync uses isHighRisk regardless of cache state', async () => {
    const lookup = new FakeLookup(['뛰어내리']);
    const signal = new KeywordSignal(lookup);
    await expect(
      signal.evaluateAsync(inputOf('다리에서 뛰어내리고 싶어')),
    ).resolves.toBe('고위험');
    await expect(signal.evaluateAsync(inputOf('산책했어'))).resolves.toBe(
      '저위험',
    );
    expect(lookup.isHighRiskCalls).toBe(2);
  });

  it('setKeywordsForTesting bypasses adapter for unit tests', () => {
    const signal = new KeywordSignal(new FakeLookup([]));
    signal.setKeywordsForTesting(['목매달']);
    expect(signal.evaluate(inputOf('목매달고 싶다는 생각'))).toBe('고위험');
    expect(signal.evaluate(inputOf('아무 생각 없다'))).toBe('저위험');
  });
});
