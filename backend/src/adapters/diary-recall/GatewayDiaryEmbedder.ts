// GatewayDiaryEmbedder — `DiaryEmbedder` 포트의 게이트웨이 경유 구현

import type { DiaryEmbedder } from '../../domain/diary/recall/ports.js';

export interface EmbeddingAIGateway {
  callExternalAI(
    target: 'embedding',
    req: { text: string },
  ):
    | Promise<{ vector: number[] }>
    | Promise<{ response: { vector: number[] } }>
    | Promise<unknown>;
}

export interface GatewayDiaryEmbedderOptions {
  readonly gateway: EmbeddingAIGateway;
}

function isNumberArray(v: unknown): v is number[] {
  return Array.isArray(v) && v.every((n) => typeof n === 'number');
}

function unwrapVector(raw: unknown): number[] {
  if (raw === null || typeof raw !== 'object') {
    return [];
  }
  const direct = (raw as { vector?: unknown }).vector;
  if (isNumberArray(direct)) {
    return direct;
  }
  const wrapped = (raw as { response?: unknown }).response;
  if (wrapped !== null && typeof wrapped === 'object') {
    const v = (wrapped as { vector?: unknown }).vector;
    if (isNumberArray(v)) {
      return v;
    }
  }
  return [];
}

export class GatewayDiaryEmbedder implements DiaryEmbedder {
  private readonly gateway: EmbeddingAIGateway;

  public constructor(options: GatewayDiaryEmbedderOptions) {
    this.gateway = options.gateway;
  }

  public async embed(text: string): Promise<number[]> {
    const trimmed = text.trim();
    if (trimmed.length === 0) {
      return [];
    }
    const raw = await this.gateway.callExternalAI('embedding', { text: trimmed });
    return unwrapVector(raw);
  }
}
