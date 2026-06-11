// DiaryProducer 순화(sanitize) 함수

import {
  EMOTION_CATEGORIES,
  type EmotionCategory,
  type EmotionScores,
} from '@nadaum/shared';

export type RiskTier = 'high' | 'medium' | 'low';

// 단일 위험 표현 대체 규칙
export interface RiskExpressionRule {
  readonly id: string;
  readonly tier: RiskTier;
  readonly pattern: RegExp;
  readonly replacements: Partial<Record<EmotionCategory, string>> & {
    default: string;
  };
}

export const RISK_EXPRESSION_RULES: ReadonlyArray<RiskExpressionRule> = [
  {
    id: 'high.destroy_all',
    tier: 'high',
    pattern: /다\s*부숴버리고\s*싶([었단]?다|어|어요|습니다)?/g,
    replacements: {
      분노: '그 순간 견디기 어려운 분노가 차올랐다',
      슬픔: '그 순간 모든 것을 놓아버리고 싶을 만큼 마음이 무거웠다',
      불안: '그 순간 통제를 잃을 것 같은 불안이 밀려왔다',
      혐오: '그 순간 모든 것이 견디기 힘들게 느껴졌다',
      default: '그 순간 마음속에 격한 감정이 차올랐다',
    },
  },
  {
    id: 'high.kill_others',
    tier: 'high',
    pattern: /(다\s*)?죽(이고|여버리고)\s*싶([었단]?다|어|어요|습니다)?/g,
    replacements: {
      분노: '주변을 향한 강한 분노가 솟구쳤다',
      슬픔: '관계 속에서 깊은 무력감을 느꼈다',
      불안: '주변에 대한 통제를 잃을 것 같은 불안이 밀려왔다',
      default: '주변을 향한 격한 감정이 차올랐다',
    },
  },
  {
    id: 'high.disappear',
    tier: 'high',
    pattern: /(사라지고|없어지고)\s*싶([었단]?다|어|어요|습니다)?/g,
    replacements: {
      슬픔: '잠시 모든 것에서 멀어지고 싶다는 마음이 들었다',
      불안: '버거움에 잠시 멀어지고 싶다는 마음이 들었다',
      혐오: '지금의 상황에서 잠시 거리를 두고 싶다는 마음이 들었다',
      default: '잠시 모든 것에서 멀어지고 싶다는 마음이 들었다',
    },
  },

  {
    id: 'medium.going_crazy',
    tier: 'medium',
    pattern: /미쳐버릴\s*것\s*같([었단]?다|아|아요|습니다)?/g,
    replacements: {
      분노: '머리가 뜨거워질 만큼 분노가 차올랐다',
      불안: '생각이 흐트러질 만큼 불안이 커졌다',
      슬픔: '마음이 어지러울 만큼 슬픔이 깊었다',
      default: '감정이 크게 흔들리는 듯했다',
    },
  },
  {
    id: 'medium.cant_endure',
    tier: 'medium',
    pattern: /참을\s*수\s*없([었단]?다|어|어요|습니다)?/g,
    replacements: {
      분노: '쉽게 가라앉지 않는 분노가 머물렀다',
      불안: '쉽게 가라앉지 않는 불안이 머물렀다',
      슬픔: '쉽게 가라앉지 않는 슬픔이 머물렀다',
      혐오: '쉽게 가라앉지 않는 거부감이 머물렀다',
      default: '쉽게 가라앉지 않는 감정이 머물렀다',
    },
  },
  {
    id: 'medium.worthless_self',
    tier: 'medium',
    pattern: /나는\s*쓸모\s*없(는\s*사람\s*이?다|다)/g,
    replacements: {
      슬픔: '내가 충분하지 않다는 생각이 깊게 들었다',
      불안: '내가 충분하지 않을지 모른다는 불안이 들었다',
      혐오: '나 자신이 마음에 들지 않는다는 생각이 들었다',
      default: '내가 충분하지 않다는 생각이 들었다',
    },
  },

  {
    id: 'low.annoyed_to_death',
    tier: 'low',
    pattern: /짜증나\s*죽(겠다|을\s*것\s*같다)/g,
    replacements: {
      분노: '많이 짜증이 났다',
      혐오: '많이 거슬리는 기분이 들었다',
      default: '많이 짜증이 났다',
    },
  },
  {
    id: 'low.dying_emphasis',
    tier: 'low',
    pattern: /([가-힣]{1,6})\s*죽겠다/g,
    replacements: {
      default: '$1 정도로 힘들었다',
    },
  },
];

export function selectDominantEmotion(scores: EmotionScores): EmotionCategory {
  let best: EmotionCategory = EMOTION_CATEGORIES[0];
  let bestScore = scores[best];
  for (const category of EMOTION_CATEGORIES) {
    const value = scores[category];
    if (value > bestScore) {
      best = category;
      bestScore = value;
    }
  }
  return best;
}

export function sanitize(
  text: string,
  dominantEmotion?: EmotionCategory,
): string {
  if (text.length === 0) {
    return text;
  }

  let result = text;
  for (const rule of RISK_EXPRESSION_RULES) {
    const replacement =
      (dominantEmotion !== undefined
        ? rule.replacements[dominantEmotion]
        : undefined) ?? rule.replacements.default;
    const localPattern = new RegExp(rule.pattern.source, rule.pattern.flags);
    result = result.replace(localPattern, replacement);
  }
  return result;
}
