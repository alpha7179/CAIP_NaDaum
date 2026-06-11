// 사용자 종료 의사 감지기

const END_INTENT_PHRASES: readonly string[] = [
  '끝낼게',
  '끝낼래',
  '끝낼래요',
  '끝내자',
  '끝내요',
  '끝낼게요',
  '마칠게',
  '마칠래',
  '마칠게요',
  '마무리할게',
  '마무리하자',
  '종료',
  '그만할게',
  '그만할래',
  '그만하자',
  '그만하고싶',
  '그만하고 싶',
  '이제 그만',
  '이제그만',
  '나갈게',
  '나갈래',
  '나갈게요',
  '대화 끝',
  '대화 그만',
] as const;

function normalize(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export function detectEndIntent(userText: string): boolean {
  if (!userText) {
    return false;
  }

  const normalized = normalize(userText);
  if (normalized.length === 0) {
    return false;
  }

  for (const phrase of END_INTENT_PHRASES) {
    if (normalized.includes(phrase)) {
      return true;
    }
  }

  return false;
}

export const END_INTENT_DICTIONARY: readonly string[] = END_INTENT_PHRASES;
