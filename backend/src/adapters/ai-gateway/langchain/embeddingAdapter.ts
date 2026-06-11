// LangChain 기반 임베딩 외부 AI 어댑터 — 프로바이더 공통 구현

import type { Embeddings } from '@langchain/core/embeddings';

import type {
  ExternalAdapter,
  ProcessedExternalAIRequest,
} from '../../../domain/ai-gateway/AIGateway.js';

export type EmbeddingsFactory = () => Embeddings;

// 임베딩 어댑터 응답 — 단일 텍스트의 임베딩 벡터
export interface EmbeddingAdapterResponse {
  readonly vector: number[];
}

export function createChatEmbeddingAdapter(
  factory: EmbeddingsFactory,
): ExternalAdapter<{ text?: string; [k: string]: unknown }, EmbeddingAdapterResponse> {
  const model = factory();
  return {
    async invoke(
      processed: ProcessedExternalAIRequest<{ text?: string; [k: string]: unknown }>,
    ): Promise<EmbeddingAdapterResponse> {
      const text = processed.text;
      if (text.length === 0) {
        return { vector: [] };
      }
      const vector = await model.embedQuery(text);
      return { vector };
    },
  };
}
