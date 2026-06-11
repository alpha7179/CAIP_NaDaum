// DiaryProducer.sanitize 단위 테스트
import type { EmotionScores } from '@nadaum/shared';
import { describe, expect, it } from 'vitest';

import {
  RISK_EXPRESSION_RULES,
  sanitize,
  selectDominantEmotion,
} from './sanitize.js';

const ZERO_SCORES: EmotionScores = {
  기쁨: 1,
  슬픔: 1,
  분노: 1,
  불안: 1,
  놀람: 1,
  혐오: 1,
  중립: 1,
};

describe('selectDominantEmotion', () => {
  it('returns the category with the strictly highest score', () => {
    const scores: EmotionScores = { ...ZERO_SCORES, 분노: 9, 슬픔: 4 };
    expect(selectDominantEmotion(scores)).toBe('분노');
  });

  it('breaks ties using EMOTION_CATEGORIES declaration order', () => {
    const scores: EmotionScores = {
      ...ZERO_SCORES,
      슬픔: 2,
      분노: 2,
      불안: 2,
    };
    expect(selectDominantEmotion(scores)).toBe('슬픔');
  });

  it('is deterministic: same input produces same output', () => {
    const scores: EmotionScores = {
      기쁨: 5,
      슬픔: 5,
      분노: 5,
      불안: 5,
      놀람: 5,
      혐오: 5,
      중립: 5,
    };
    const a = selectDominantEmotion(scores);
    const b = selectDominantEmotion(scores);
    expect(a).toBe(b);
    expect(a).toBe('기쁨');
  });
});

describe('sanitize: empty / unaffected input', () => {
  it('returns empty string unchanged', () => {
    expect(sanitize('')).toBe('');
    expect(sanitize('', '분노')).toBe('');
  });

  it('returns text without risky expressions unchanged', () => {
    const text = '오늘은 산책을 하며 마음이 한결 가벼워졌다.';
    expect(sanitize(text)).toBe(text);
    expect(sanitize(text, '기쁨')).toBe(text);
  });
});

describe('sanitize: high-tier replacements preserve dominant emotion', () => {
  it('replaces "다 부숴버리고 싶었다" with anger-preserving variant when 분노 is dominant', () => {
    const out = sanitize('그때 나는 다 부숴버리고 싶었다.', '분노');
    expect(out).toContain('견디기 어려운 분노가 차올랐다');
    expect(out).not.toContain('부숴버리고');
  });

  it('replaces "다 부숴버리고 싶다" with sadness-preserving variant when 슬픔 is dominant', () => {
    const out = sanitize('이대로 다 부숴버리고 싶다.', '슬픔');
    expect(out).toContain('모든 것을 놓아버리고 싶을 만큼 마음이 무거웠다');
    expect(out).not.toContain('부숴버리고');
  });

  it('falls back to the default replacement when dominantEmotion is omitted', () => {
    const out = sanitize('다 부숴버리고 싶었다.');
    expect(out).toContain('마음속에 격한 감정이 차올랐다');
  });

  it('replaces self-disappearance expressions with reflective phrasing', () => {
    const out = sanitize('그냥 사라지고 싶었다.', '슬픔');
    expect(out).toContain('잠시 모든 것에서 멀어지고 싶다는 마음이 들었다');
    expect(out).not.toContain('사라지고 싶');
  });
});

describe('sanitize: medium-tier replacements', () => {
  it('replaces "미쳐버릴 것 같다" with calmer reflection preserving 분노', () => {
    const out = sanitize('그 상황에 미쳐버릴 것 같았다.', '분노');
    expect(out).toContain('머리가 뜨거워질 만큼 분노가 차올랐다');
    expect(out).not.toContain('미쳐버릴');
  });

  it('replaces "참을 수 없다" with sustained-emotion phrasing for 불안', () => {
    const out = sanitize('도저히 참을 수 없었다.', '불안');
    expect(out).toContain('쉽게 가라앉지 않는 불안이 머물렀다');
    expect(out).not.toContain('참을 수 없');
  });
});

describe('sanitize: low-tier replacements', () => {
  it('replaces "짜증나 죽겠다" with softened expression', () => {
    const out = sanitize('정말 짜증나 죽겠다.', '분노');
    expect(out).toContain('많이 짜증이 났다');
    expect(out).not.toContain('죽겠다');
  });

  it('preserves the qualifier in generic "~죽겠다" emphasis', () => {
    const out = sanitize('너무 피곤해 죽겠다.');
    expect(out).toMatch(/정도로 힘들었다/);
    expect(out).not.toContain('죽겠다');
  });
});

describe('sanitize: idempotency', () => {
  const corpora = [
    '',
    '오늘은 평온한 하루였다.',
    '그때 나는 다 부숴버리고 싶었다.',
    '이대로 사라지고 싶다.',
    '그 상황에 미쳐버릴 것 같았다. 도저히 참을 수 없었다.',
    '나는 쓸모없다. 정말 짜증나 죽겠다.',
    '너무 피곤해 죽겠다. 다 부숴버리고 싶다.',
  ];

  for (const text of corpora) {
    for (const emotion of [undefined, '분노', '슬픔', '불안'] as const) {
      it(`is idempotent for ${JSON.stringify(text)} (emotion=${emotion ?? 'none'})`, () => {
        const once = sanitize(text, emotion);
        const twice = sanitize(once, emotion);
        expect(twice).toBe(once);
      });
    }
  }
});

describe('RISK_EXPRESSION_RULES coverage', () => {
  it('includes at least one rule per tier (low / medium / high)', () => {
    const tiers = new Set(RISK_EXPRESSION_RULES.map((r) => r.tier));
    expect(tiers.has('low')).toBe(true);
    expect(tiers.has('medium')).toBe(true);
    expect(tiers.has('high')).toBe(true);
  });

  it('orders high-tier rules before medium-tier and medium before low', () => {
    const tierRank = { high: 0, medium: 1, low: 2 } as const;
    let prev = -1;
    for (const rule of RISK_EXPRESSION_RULES) {
      const rank = tierRank[rule.tier];
      expect(rank).toBeGreaterThanOrEqual(prev);
      prev = rank;
    }
  });

  it('each rule uses the global flag for full-text replacement', () => {
    for (const rule of RISK_EXPRESSION_RULES) {
      expect(rule.pattern.flags).toContain('g');
    }
  });
});
