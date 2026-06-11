// 결정적 페이크 외부 AI 어댑터 — 로컬/테스트용

import type {
  ExternalAdapter,
  ProcessedExternalAIRequest,
} from '../../../domain/ai-gateway/AIGateway.js';

export const fakeEmotionAdapter: ExternalAdapter = {
  async invoke(): Promise<{ raw: string }> {
    return {
      raw: JSON.stringify({
        scores: { 기쁨: 2, 슬픔: 8, 분노: 3, 불안: 6, 놀람: 2, 혐오: 2, 중립: 4 },
        distortions: ['파국화'],
        confidence: 0.8,
      }),
    };
  },
};

export const fakeDialogueAdapter: ExternalAdapter = {
  async invoke(
    processed: ProcessedExternalAIRequest,
  ): Promise<{ text: string }> {
    const userText =
      typeof (processed.raw as { userText?: unknown }).userText === 'string'
        ? (processed.raw as { userText: string }).userText
        : '';
    return {
      text: `"${userText}"라고 느끼셨군요. 그 마음을 조금 더 들려주실 수 있을까요?`,
    };
  },
};

export const fakeDiaryAdapter: ExternalAdapter = {
  async invoke(): Promise<{ text: string }> {
    const sentence = '나는 오늘 하루를 천천히 돌아보며 마음을 가만히 들여다보았다. ';
    return { text: `제목: 하루의 끝\n태그: #회고 #쉼 #마음\n본문: ${sentence.repeat(12)}` };
  },
};

export const fakeRiskAdapter: ExternalAdapter = {
  async invoke(): Promise<{ raw: string }> {
    return { raw: JSON.stringify({ level: '저위험', score: 0 }) };
  },
};

export const FAKE_EXTERNAL_ADAPTERS = {
  gpt4o_emotion: fakeEmotionAdapter,
  gpt4o_dialogue: fakeDialogueAdapter,
  gpt4o_diary: fakeDiaryAdapter,
  gpt4o_risk: fakeRiskAdapter,
} as const;
