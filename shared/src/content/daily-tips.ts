// 일상 웰니스 팁 정적 데이터

import { EMOTION_CATEGORIES, type EmotionCategory, type EmotionScores } from '../types/emotion.js';

// 단일 일상 웰니스 팁 항목
export interface DailyTip {
  id: string;
  category: keyof EmotionScores;
  text: string;
}

export const DAILY_TIPS: readonly DailyTip[] = Object.freeze([
  { id: '기쁨-1', category: '기쁨', text: '오늘의 좋았던 순간을 한 줄로 적어 두면, 같은 기분이 더 오래 머무릅니다.' },
  { id: '기쁨-2', category: '기쁨', text: '함께 웃을 사람에게 짧은 안부 메시지를 보내 보세요. 기쁨은 나눌수록 깊어집니다.' },
  { id: '기쁨-3', category: '기쁨', text: '좋아하는 음악을 한 곡 골라 가만히 끝까지 들어 보세요.' },
  { id: '기쁨-4', category: '기쁨', text: '햇볕이 드는 자리에서 5분간 천천히 숨을 고르며 지금의 기분을 느껴 보세요.' },
  { id: '기쁨-5', category: '기쁨', text: '오늘 잘한 일 한 가지에 스스로에게 작은 칭찬을 건네 보세요.' },
  { id: '기쁨-6', category: '기쁨', text: '가벼운 산책으로 몸을 움직이면, 좋은 기분이 더 또렷해집니다.' },
  { id: '기쁨-7', category: '기쁨', text: '감사한 사람·사건 세 가지를 떠올려 마음속으로 인사를 건네 보세요.' },

  { id: '슬픔-1', category: '슬픔', text: '슬픔도 자연스러운 감정입니다. 억지로 밀어내지 말고 잠시 머물러도 괜찮아요.' },
  { id: '슬픔-2', category: '슬픔', text: '따뜻한 차나 물 한 잔을 천천히 마시며 호흡을 가다듬어 보세요.' },
  { id: '슬픔-3', category: '슬픔', text: '편안한 자세로 앉아 4초 들숨, 6초 날숨을 다섯 번 반복해 보세요.' },
  { id: '슬픔-4', category: '슬픔', text: '믿을 만한 사람에게 지금 기분을 한 문장으로 전해 보세요. 말로 꺼내는 순간 무게가 줄어듭니다.' },
  { id: '슬픔-5', category: '슬픔', text: '오래 좋아해 온 음악·사진·기억을 한 가지 떠올려 잠시 머물러 보세요.' },
  { id: '슬픔-6', category: '슬픔', text: '오늘 해야 할 일을 가장 작은 한 가지로 줄이고, 거기까지만 해도 충분합니다.' },
  { id: '슬픔-7', category: '슬픔', text: '햇빛이 드는 창가나 가까운 공원에서 10분만 걸어 보세요.' },

  { id: '분노-1', category: '분노', text: '잠깐 자리를 옮겨 6초 들숨, 8초 날숨을 다섯 번 반복하며 몸을 식혀 주세요.' },
  { id: '분노-2', category: '분노', text: '주먹을 5초간 꽉 쥐었다가 천천히 펴는 동작을 세 번 해 보세요. 몸의 긴장이 풀리면 마음도 한 박자 늦춰집니다.' },
  { id: '분노-3', category: '분노', text: '지금 떠오르는 말은 메모장에 먼저 적어 두고, 30분 후에 다시 읽어 보세요.' },
  { id: '분노-4', category: '분노', text: '시원한 물로 손목을 잠깐 적시면 흥분이 가라앉는 데 도움이 됩니다.' },
  { id: '분노-5', category: '분노', text: '귀에 익숙한 잔잔한 음악을 한 곡 들으며 어깨와 턱의 힘을 풀어 보세요.' },
  { id: '분노-6', category: '분노', text: '“나는 지금 화가 났다”라고 마음속으로 분명히 이름 붙여 보면, 충동과 거리가 생깁니다.' },

  { id: '불안-1', category: '불안', text: '주변에서 보이는 5가지, 들리는 4가지, 만질 수 있는 3가지를 천천히 세어 보세요(접지 호흡).' },
  { id: '불안-2', category: '불안', text: '4초 들숨 - 4초 멈춤 - 6초 날숨을 다섯 번 반복하며 호흡을 길게 가져가 보세요.' },
  { id: '불안-3', category: '불안', text: '걱정거리를 한 줄씩 적은 뒤, 지금 당장 할 수 있는 일과 그렇지 않은 일로 나눠 보세요.' },
  { id: '불안-4', category: '불안', text: '발바닥이 바닥에 닿는 감각에 1분간 집중해 보세요. 지금 이 자리에 안전하게 있다는 사실을 몸이 먼저 알게 됩니다.' },
  { id: '불안-5', category: '불안', text: '가능한 만큼 어깨를 천천히 위로 올렸다가 한숨과 함께 떨어뜨리는 동작을 세 번 반복해 보세요.' },
  { id: '불안-6', category: '불안', text: '카페인은 잠시 줄이고, 따뜻한 물 한 잔으로 속도를 늦춰 보세요.' },
  { id: '불안-7', category: '불안', text: '잠들기 어려운 밤에는 불빛을 줄이고 같은 시간에 눕는 작은 규칙을 만들어 보세요.' },

  { id: '놀람-1', category: '놀람', text: '예상 못한 일이 있을 때는 한 호흡 길게 내쉬고, 지금 안전한지 가볍게 확인해 보세요.' },
  { id: '놀람-2', category: '놀람', text: '방금 일어난 일을 한 문장으로 정리해 적어 보면 머리가 빠르게 정돈됩니다.' },
  { id: '놀람-3', category: '놀람', text: '잠시 자리를 떠나 물 한 잔을 마시며 “지금 무엇이 가장 놀라웠는지” 스스로 물어보세요.' },
  { id: '놀람-4', category: '놀람', text: '느낀 감정이 놀람 외에 무엇과 섞여 있는지(불안·슬픔·기대 등) 한두 가지 더 짚어 보세요.' },
  { id: '놀람-5', category: '놀람', text: '오늘은 큰 결정을 미루고, 가능한 한 익숙한 환경에서 휴식을 취해 보세요.' },

  { id: '혐오-1', category: '혐오', text: '불편한 자극에서 잠시 거리를 두고, 좋아하는 향이나 풍경에 감각을 옮겨 보세요.' },
  { id: '혐오-2', category: '혐오', text: '“이 감정은 나를 보호하려는 신호일 수 있다”라고 한 번 떠올려 보세요. 감정에 이름을 붙이면 거리가 생깁니다.' },
  { id: '혐오-3', category: '혐오', text: '편한 자세로 앉아 천천히 호흡하며 어깨와 가슴의 긴장을 풀어 주세요.' },
  { id: '혐오-4', category: '혐오', text: '가능하면 환기를 하고, 주변을 정리하는 작은 행동으로 환경부터 가다듬어 보세요.' },
  { id: '혐오-5', category: '혐오', text: '신뢰하는 사람에게 “지금 이게 불편하다”라고 짧게 말해 보세요. 상황을 바꾸기 어렵더라도 마음의 무게는 가벼워집니다.' },

  { id: '중립-1', category: '중립', text: '평온할 때일수록 물 마시기·짧은 산책 같은 작은 루틴을 챙기면 다음의 흔들림이 줄어듭니다.' },
  { id: '중립-2', category: '중립', text: '오늘 하루를 한 줄로 요약해 적어 보세요. 평범한 날을 기록하는 습관이 큰 자산이 됩니다.' },
  { id: '중립-3', category: '중립', text: '5분간 가벼운 스트레칭으로 굳어 있던 어깨와 목을 풀어 주세요.' },
  { id: '중립-4', category: '중립', text: '편안한 호흡을 1분간 관찰해 보세요. 특별히 떠오르는 생각이 있다면 한 줄로 메모해 두세요.' },
  { id: '중립-5', category: '중립', text: '오늘 만난 사람 한 명에게 짧은 안부를 전해 보세요. 큰 변화 없이도 관계가 천천히 깊어집니다.' },
  { id: '중립-6', category: '중립', text: '잠들기 30분 전에는 화면을 잠시 멀리하고, 같은 시간에 잠드는 리듬을 만들어 보세요.' },
]);

const TIPS_BY_CATEGORY: Readonly<Record<EmotionCategory, readonly DailyTip[]>> = (() => {
  const grouped: Record<EmotionCategory, DailyTip[]> = {
    기쁨: [],
    슬픔: [],
    분노: [],
    불안: [],
    놀람: [],
    혐오: [],
    중립: [],
  };
  for (const tip of DAILY_TIPS) {
    grouped[tip.category].push(tip);
  }
  const frozen = {} as Record<EmotionCategory, readonly DailyTip[]>;
  for (const category of EMOTION_CATEGORIES) {
    frozen[category] = Object.freeze([...grouped[category]]);
  }
  return Object.freeze(frozen);
})();

for (const category of EMOTION_CATEGORIES) {
  const count = TIPS_BY_CATEGORY[category].length;
  if (count < 5 || count > 10) {
    throw new Error(
      `[daily-tips] 감정 범주 '${category}'의 팁 수가 5~10 범위를 벗어났습니다: ${count}`,
    );
  }
}

export function tipsForEmotion(
  category: keyof EmotionScores,
  count = 1,
  random: () => number = Math.random,
): DailyTip[] {
  const pool = TIPS_BY_CATEGORY[category as EmotionCategory];
  if (!pool || pool.length === 0) {
    return [];
  }

  const requested = Number.isFinite(count) ? Math.floor(count) : 1;
  const clamped = Math.min(3, Math.max(1, requested));
  const k = Math.min(clamped, pool.length);

  const indices = pool.map((_, i) => i);
  for (let i = 0; i < k; i++) {
    const j = i + Math.floor(random() * (indices.length - i));
    const tmp = indices[i]!;
    indices[i] = indices[j]!;
    indices[j] = tmp;
  }
  return indices.slice(0, k).map((i) => pool[i]!);
}
