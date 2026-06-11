// Google Gemini 외부 AI 어댑터 — LangChain ChatGoogleGenerativeAI 기반

import { ChatGoogleGenerativeAI } from '@langchain/google-genai';

import type { ExternalAdapter } from '../../../domain/ai-gateway/AIGateway.js';
import {
  createChatAdapters,
  createChatDialogueAdapter,
  type ChatModelFactory,
} from '../langchain/chatAdapters.js';

const DEFAULT_MODEL = 'gemini-2.5-flash';

// Gemini 채팅 모델 설정
export interface GeminiChatConfig {
  readonly apiKey: string;
  readonly baseUrl?: string;
  readonly model?: string;
}

export function createGeminiChatModelFactory(config: GeminiChatConfig): ChatModelFactory {
  const { apiKey, baseUrl, model } = config;
  return ({ temperature, json }) =>
    new ChatGoogleGenerativeAI({
      model: model ?? DEFAULT_MODEL,
      apiKey,
      temperature,
      ...(baseUrl !== undefined && baseUrl.length > 0 ? { baseUrl } : {}),
      ...(json ? { json: true } : {}),
    });
}

export function createGeminiDialogueAdapter(config: GeminiChatConfig): ExternalAdapter {
  return createChatDialogueAdapter(createGeminiChatModelFactory(config));
}

export function createGeminiAdapters(config: GeminiChatConfig): {
  gpt4o_emotion: ExternalAdapter;
  gpt4o_dialogue: ExternalAdapter;
  gpt4o_diary: ExternalAdapter;
  gpt4o_risk: ExternalAdapter;
} {
  return createChatAdapters(createGeminiChatModelFactory(config));
}
