// 5단계 대화 흐름 단계 전이 결정 함수

import { CONVERSATION_STAGES, type ConversationStage } from '@nadaum/shared';

export function getNextStage(
  current: ConversationStage,
  hadExchangeInStage: boolean,
  endIntent: boolean,
): ConversationStage {
  if (endIntent) {
    return '부드러운마무리';
  }

  const currentIndex = CONVERSATION_STAGES.indexOf(current);

  const lastIndex = CONVERSATION_STAGES.length - 1;
  if (currentIndex < 0 || currentIndex >= lastIndex) {
    return '부드러운마무리';
  }

  if (!hadExchangeInStage) {
    return current;
  }

  return CONVERSATION_STAGES[currentIndex + 1] as ConversationStage;
}
