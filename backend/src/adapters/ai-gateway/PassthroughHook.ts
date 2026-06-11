// 비식별화 훅 어댑터 — 입력 텍스트를 그대로 통과
import type {
  DeidentificationHook,
  HookProcessInput,
  HookProcessResult,
} from '../../domain/ai-gateway/DeidentificationHook.js';

function nowMs(): number {
  return performance.now();
}

export class PassthroughHook implements DeidentificationHook {
  public readonly hookId = 'passthrough';

  public async process(input: HookProcessInput): Promise<HookProcessResult> {
    const start = nowMs();
    const text = input.text;
    const latencyMs = Math.max(0, nowMs() - start);
    return {
      text,
      masked: false,
      detectedPiiCategories: [],
      tokenMappings: [],
      meta: { latencyMs },
    };
  }
}

export const defaultPassthroughHook: DeidentificationHook = new PassthroughHook();
