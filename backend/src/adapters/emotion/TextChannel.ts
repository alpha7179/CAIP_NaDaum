// TextChannel — GPT-4o 기반 텍스트 감정 분석 채널 어댑터 (활성 구현)

import {
  COGNITIVE_DISTORTIONS,
  EMOTION_CATEGORIES,
  type ChannelResult,
  type CognitiveDistortion,
  type EmotionScores,
} from '@nadaum/shared';

import type {
  ChannelAnalyzeContext,
  ChannelInput,
  EmotionChannel,
} from '../../domain/emotion/EmotionChannel.js';

export interface EmotionGatewayRequest {
  readonly prompt: string;
  readonly schema: {
    readonly emotions: readonly string[];
    readonly distortions: readonly string[];
  };
  readonly signal?: AbortSignal;
}

export interface EmotionGatewayResponse {
  readonly parsed?: unknown;
  readonly raw?: string;
}

export interface EmotionAIGateway {
  callExternalAI(
    target: 'gpt4o_emotion',
    req: EmotionGatewayRequest,
  ): Promise<EmotionGatewayResponse>;
}

export interface TextChannelOptions {
  readonly gateway: EmotionAIGateway;
  readonly modelVersion?: string;
  readonly perAttemptTimeoutMs?: number;
  readonly retryDelayMs?: number;
  readonly maxAttempts?: number;
  readonly nowMs?: () => number;
  readonly sleep?: (ms: number) => Promise<void>;
}

const DEFAULT_PER_ATTEMPT_TIMEOUT_MS = 10_000;
const DEFAULT_RETRY_DELAY_MS = 2_000;
const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_MODEL_VERSION = 'gpt-4o';

const SCORE_MIN = 1;
const SCORE_MAX = 10;
const NEUTRAL_DEFAULT = 5;

const COGNITIVE_DISTORTION_SET: ReadonlySet<CognitiveDistortion> = new Set(
  COGNITIVE_DISTORTIONS,
);

function clampRound(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return NEUTRAL_DEFAULT;
  }
  const rounded = Math.round(value);
  if (rounded < SCORE_MIN) {
    return SCORE_MIN;
  }
  if (rounded > SCORE_MAX) {
    return SCORE_MAX;
  }
  return rounded;
}

function normalizeScores(raw: unknown): EmotionScores {
  const source =
    typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  return {
    기쁨: clampRound(source['기쁨']),
    슬픔: clampRound(source['슬픔']),
    분노: clampRound(source['분노']),
    불안: clampRound(source['불안']),
    놀람: clampRound(source['놀람']),
    혐오: clampRound(source['혐오']),
    중립: clampRound(source['중립']),
  };
}

function normalizeDistortions(raw: unknown): CognitiveDistortion[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const seen = new Set<CognitiveDistortion>();
  for (const item of raw) {
    if (typeof item !== 'string') {
      continue;
    }
    if (COGNITIVE_DISTORTION_SET.has(item as CognitiveDistortion)) {
      seen.add(item as CognitiveDistortion);
    }
  }
  return [...seen];
}

function normalizeConfidence(raw: unknown): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    return 1;
  }
  if (raw < 0) {
    return 0;
  }
  if (raw > 1) {
    return 1;
  }
  return raw;
}

function parseResponseBody(response: EmotionGatewayResponse): unknown {
  if (response.parsed !== undefined) {
    return response.parsed;
  }
  if (typeof response.raw === 'string') {
    return JSON.parse(response.raw) as unknown;
  }
  throw new TextChannelMalformedResponseError(
    'gateway response missing both parsed and raw fields',
  );
}

export class TextChannelMalformedResponseError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'TextChannelMalformedResponseError';
  }
}

export class TextChannelExhaustedError extends Error {
  public readonly attempts: number;
  public constructor(attempts: number, cause: unknown) {
    super(
      `TextChannel exhausted after ${attempts} attempt(s): ${
        cause instanceof Error ? cause.message : String(cause)
      }`,
    );
    this.name = 'TextChannelExhaustedError';
    this.attempts = attempts;
    (this as { cause?: unknown }).cause = cause;
  }
}

export function buildEmotionPrompt(text: string): string {
  const emotions = EMOTION_CATEGORIES.join(', ');
  const distortions = COGNITIVE_DISTORTIONS.join(', ');
  return [
    '당신은 한국어 발화의 감정을 분석하는 분류기입니다.',
    `다음 7가지 감정 범주 각각에 대해 1-10 정수 척도 점수를 산출하세요: ${emotions}.`,
    `또한 발화에서 다음 인지왜곡 패턴 중 해당하는 것을 모두 선택하세요: ${distortions}.`,
    '응답은 반드시 JSON 객체 한 개로만 구성하며, 다른 설명·코드블록·자연어 텍스트를 포함하지 마세요.',
    'JSON 스키마:',
    '{',
    '  "scores": { "기쁨": <int 1-10>, "슬픔": <int 1-10>, "분노": <int 1-10>, "불안": <int 1-10>, "놀람": <int 1-10>, "혐오": <int 1-10>, "중립": <int 1-10> },',
    '  "distortions": [<위 4개 중 0개 이상>],',
    '  "confidence": <0-1 사이의 실수>',
    '}',
    '발화:',
    text,
  ].join('\n');
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function withTimeout<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
): Promise<T> {
  const controller = new AbortController();
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      controller.abort();
      reject(new Error(`TextChannel call timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });
  try {
    return await Promise.race([fn(controller.signal), timeoutPromise]);
  } finally {
    if (timeoutHandle !== undefined) {
      clearTimeout(timeoutHandle);
    }
  }
}

export class TextChannel implements EmotionChannel {
  public readonly channelId = 'text';

  private readonly gateway: EmotionAIGateway;
  private readonly modelVersion: string;
  private readonly perAttemptTimeoutMs: number;
  private readonly retryDelayMs: number;
  private readonly maxAttempts: number;
  private readonly nowMs: () => number;
  private readonly sleep: (ms: number) => Promise<void>;

  public constructor(options: TextChannelOptions) {
    this.gateway = options.gateway;
    this.modelVersion = options.modelVersion ?? DEFAULT_MODEL_VERSION;
    this.perAttemptTimeoutMs =
      options.perAttemptTimeoutMs ?? DEFAULT_PER_ATTEMPT_TIMEOUT_MS;
    this.retryDelayMs = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
    this.maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
    this.nowMs = options.nowMs ?? ((): number => performance.now());
    this.sleep = options.sleep ?? defaultSleep;
  }

  public async isAvailable(): Promise<boolean> {
    return true;
  }

  public async analyze(
    input: ChannelInput,
    _context: ChannelAnalyzeContext,
  ): Promise<ChannelResult> {
    const text = typeof input.text === 'string' ? input.text.trim() : '';
    const callStart = this.nowMs();

    if (text.length === 0) {
      return {
        channelId: this.channelId,
        scores: {
          기쁨: NEUTRAL_DEFAULT,
          슬픔: NEUTRAL_DEFAULT,
          분노: NEUTRAL_DEFAULT,
          불안: NEUTRAL_DEFAULT,
          놀람: NEUTRAL_DEFAULT,
          혐오: NEUTRAL_DEFAULT,
          중립: NEUTRAL_DEFAULT,
        },
        distortions: [],
        confidence: 0,
        meta: {
          latencyMs: Math.max(0, this.nowMs() - callStart),
          modelVersion: this.modelVersion,
        },
      };
    }

    const prompt = buildEmotionPrompt(text);
    const schema = {
      emotions: EMOTION_CATEGORIES,
      distortions: COGNITIVE_DISTORTIONS,
    } as const;

    let lastError: unknown;
    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      try {
        const response = await withTimeout(
          (signal) =>
            this.gateway.callExternalAI('gpt4o_emotion', {
              prompt,
              schema,
              signal,
            }),
          this.perAttemptTimeoutMs,
        );
        const parsed = parseResponseBody(response);
        const body =
          typeof parsed === 'object' && parsed !== null
            ? (parsed as Record<string, unknown>)
            : {};
        const scores = normalizeScores(body['scores']);
        const distortions = normalizeDistortions(body['distortions']);
        const confidence = normalizeConfidence(body['confidence']);
        return {
          channelId: this.channelId,
          scores,
          distortions,
          confidence,
          meta: {
            latencyMs: Math.max(0, this.nowMs() - callStart),
            modelVersion: this.modelVersion,
          },
        };
      } catch (err) {
        lastError = err;
        if (attempt < this.maxAttempts) {
          await this.sleep(this.retryDelayMs);
        }
      }
    }
    throw new TextChannelExhaustedError(this.maxAttempts, lastError);
  }
}
