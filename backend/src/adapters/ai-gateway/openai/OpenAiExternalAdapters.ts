// OpenAI 외부 AI 어댑터 — LangChain ChatOpenAI 기반

import { ChatOpenAI } from '@langchain/openai';

import type { ExternalAdapter } from '../../../domain/ai-gateway/AIGateway.js';
import {
  createChatAdapters,
  createChatDialogueAdapter,
  type ChatModelFactory,
} from '../langchain/chatAdapters.js';

const DEFAULT_CHAT_MODEL = 'gpt-4o';

// OpenAI 채팅 모델 설정
export interface OpenAiChatConfig {
  readonly apiKey?: string;
  readonly baseUrl?: string;
  readonly model?: string;
}

export function createOpenAiChatModelFactory(config: OpenAiChatConfig = {}): ChatModelFactory {
  const { apiKey, baseUrl, model } = config;
  return ({ temperature, json }) =>
    new ChatOpenAI({
      model: model ?? DEFAULT_CHAT_MODEL,
      temperature,
      maxRetries: 5,
      timeout: 60_000,
      ...(apiKey !== undefined && apiKey.length > 0 ? { apiKey } : {}),
      ...(baseUrl !== undefined && baseUrl.length > 0
        ? { configuration: { baseURL: baseUrl } }
        : {}),
      ...(json ? { modelKwargs: { response_format: { type: 'json_object' } } } : {}),
    });
}

export function createOpenAiDialogueAdapter(config: OpenAiChatConfig = {}): ExternalAdapter {
  return createChatDialogueAdapter(createOpenAiChatModelFactory(config));
}

export function createOpenAiAdapters(config: OpenAiChatConfig = {}): {
  gpt4o_emotion: ExternalAdapter;
  gpt4o_dialogue: ExternalAdapter;
  gpt4o_diary: ExternalAdapter;
  gpt4o_risk: ExternalAdapter;
} {
  return createChatAdapters(createOpenAiChatModelFactory(config));
}
