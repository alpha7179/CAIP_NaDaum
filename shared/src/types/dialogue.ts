// 대화 흐름 도메인 공유 타입

export type ConversationStage =
  | '상황파악'
  | '감정탐색'
  | '생각탐색'
  | '패턴연결'
  | '부드러운마무리';

export const CONVERSATION_STAGES = [
  '상황파악',
  '감정탐색',
  '생각탐색',
  '패턴연결',
  '부드러운마무리',
] as const satisfies ReadonlyArray<ConversationStage>;

// 사용자/AI 발화-응답 단위 (세션 메모리 최대 50회 FIFO)
export interface Exchange {
  role: 'user' | 'ai';
  text: string;
  timestamp: Date;
}
