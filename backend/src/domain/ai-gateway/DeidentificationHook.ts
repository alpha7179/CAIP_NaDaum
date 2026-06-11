// 비식별화 훅 도메인 인터페이스

export type ExternalAITarget =
  | 'gpt4o_emotion'
  | 'gpt4o_dialogue'
  | 'gpt4o_diary'
  | 'gpt4o_risk'
  | 'embedding'
  | 'hume_prosody'
  | 'elevenlabs_tts';

export interface HookContext {
  readonly userId: string;
  readonly sessionId?: string;
  readonly callTarget: ExternalAITarget;
}

export interface HookProcessInput {
  readonly text: string;
  readonly context: HookContext;
}

export interface TokenMapping {
  readonly tokenId: string;
  readonly original: string;
  readonly replacement: string;
}

export interface HookResultMeta {
  readonly latencyMs: number;
}

export interface HookProcessResult {
  readonly text: string;
  readonly masked: boolean;
  readonly detectedPiiCategories: readonly string[];
  readonly tokenMappings: readonly TokenMapping[];
  readonly meta: HookResultMeta;
}

// 비식별화 훅 도메인 인터페이스
export interface DeidentificationHook {
  readonly hookId: string;

  process(input: HookProcessInput): Promise<HookProcessResult>;
}
