// OpenAI 임베딩 어댑터 — LangChain OpenAIEmbeddings 기반

import { OpenAIEmbeddings } from '@langchain/openai';

import type { ExternalAdapter } from '../../../domain/ai-gateway/AIGateway.js';
import {
  createChatEmbeddingAdapter,
  type EmbeddingAdapterResponse,
  type EmbeddingsFactory,
} from '../langchain/embeddingAdapter.js';

export const DEFAULT_EMBEDDING_MODEL = 'text-embedding-3-small';
export const DEFAULT_EMBEDDING_DIMENSIONS = 1536;

// OpenAI 임베딩 모델 설정
export interface OpenAiEmbeddingConfig {
  readonly apiKey?: string;
  readonly baseUrl?: string;
  readonly model?: string;
  readonly dimensions?: number;
}

export function createOpenAiEmbeddingsFactory(
  config: OpenAiEmbeddingConfig = {},
): EmbeddingsFactory {
  const { apiKey, baseUrl, model, dimensions } = config;
  return () =>
    new OpenAIEmbeddings({
      model: model ?? DEFAULT_EMBEDDING_MODEL,
      dimensions: dimensions ?? DEFAULT_EMBEDDING_DIMENSIONS,
      maxRetries: 5,
      timeout: 60_000,
      ...(apiKey !== undefined && apiKey.length > 0 ? { apiKey } : {}),
      ...(baseUrl !== undefined && baseUrl.length > 0
        ? { configuration: { baseURL: baseUrl } }
        : {}),
    });
}

export function createOpenAiEmbeddingAdapter(
  config: OpenAiEmbeddingConfig = {},
): ExternalAdapter<{ text?: string; [k: string]: unknown }, EmbeddingAdapterResponse> {
  return createChatEmbeddingAdapter(createOpenAiEmbeddingsFactory(config));
}
