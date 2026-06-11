// 공감형 대화 엔진 도메인 인터페이스

import type {
  ConversationStage,
  EmotionAnalysisResult,
  Exchange,
  SessionContext,
} from '@nadaum/shared';

import type { RecalledDiary } from '../diary/recall/types.js';

import { detectEndIntent } from './EndIntentDetector.js';
import {
  detectMedicalKeywords,
  type MedicalKeywordDetection,
} from './MedicalKeywordDetector.js';
import { getNextStage } from './StageTransition.js';

export interface DialogueGenerateInput {
  userText: string;
  sessionContext: SessionContext;
  latestEmotion: EmotionAnalysisResult;
  recalledDiaries?: RecalledDiary[];
}

export interface DialogueResult {
  aiResponse: string;
  nextStage: ConversationStage;
  isMedicalRedirect: boolean;
  generatedAt: Date;
}

export interface DialogueGenerator {
  generate(input: DialogueGeneratorInput): Promise<DialogueGeneratorOutput>;
}

export interface DialogueGeneratorInput {
  userText: string;
  stage: ConversationStage;
  latestEmotion: EmotionAnalysisResult;
  recentExchanges: Exchange[];
  medicalDetection: MedicalKeywordDetection;
  endIntent: boolean;
  recalledDiaries?: RecalledDiary[];
}

export interface DialogueGeneratorOutput {
  aiResponse: string;
}

// 공감형 대화 엔진 도메인 인터페이스
export interface DialogueEngine {
  generateResponse(input: DialogueGenerateInput): Promise<DialogueResult>;

  detectEndIntent(userText: string): boolean;

  detectMedicalKeywords(userText: string): boolean;
}

export function hasUserExchangeInStage(context: SessionContext): boolean {
  return context.exchanges.some((ex) => ex.role === 'user');
}

// DialogueEngine의 도메인 구현
export class DialogueEngineImpl implements DialogueEngine {
  constructor(private readonly generator: DialogueGenerator) {}

  detectEndIntent(userText: string): boolean {
    return detectEndIntent(userText);
  }

  detectMedicalKeywords(userText: string): boolean {
    return detectMedicalKeywords(userText).isMedicalRedirect;
  }

  async generateResponse(input: DialogueGenerateInput): Promise<DialogueResult> {
    const { userText, sessionContext, latestEmotion, recalledDiaries } = input;

    const endIntent = detectEndIntent(userText);
    const medicalDetection = detectMedicalKeywords(userText);

    const recentExchanges = sessionContext.exchanges;

    const generated = await this.generator.generate({
      userText,
      stage: sessionContext.stage,
      latestEmotion,
      recentExchanges,
      medicalDetection,
      endIntent,
      ...(recalledDiaries !== undefined ? { recalledDiaries } : {}),
    });

    const hadExchangeInStage = hasUserExchangeInStage(sessionContext);
    const nextStage = getNextStage(sessionContext.stage, hadExchangeInStage, endIntent);

    return {
      aiResponse: generated.aiResponse,
      nextStage,
      isMedicalRedirect: medicalDetection.isMedicalRedirect,
      generatedAt: new Date(),
    };
  }
}
