// Gpt4oDialogueAdapter — GPT-4o 기반 공감형 대화 생성 어댑터 (활성 구현)

import type {
  DialogueGenerator,
  DialogueGeneratorInput,
  DialogueGeneratorOutput,
} from '../../domain/dialogue/DialogueEngine.js';
import {
  buildSystemPrompt,
  type BuildSystemPromptArgs,
} from '../../domain/dialogue/system-prompt.js';

// 단일 GPT-4o 대화 생성 호출 요청
export interface DialogueGatewayRequest {
  readonly systemPrompt: string;
  readonly userText: string;
  readonly signal?: AbortSignal;
}

// GPT-4o 대화 생성 호출 응답
export interface DialogueGatewayResponse {
  readonly text?: string;
  readonly raw?: string;
}

// `Gpt4oDialogueAdapter`가 의존하는 최소 AIGateway 포트
export interface DialogueAIGateway {
  callExternalAI(
    target: 'gpt4o_dialogue',
    req: DialogueGatewayRequest,
  ): Promise<DialogueGatewayResponse | { response: DialogueGatewayResponse }>;
}

// `Gpt4oDialogueAdapter` 생성자 옵션
export interface Gpt4oDialogueAdapterOptions {
  readonly gateway: DialogueAIGateway;
  readonly perAttemptTimeoutMs?: number;
  readonly retryDelayMs?: number;
  readonly maxAttempts?: number;
  readonly sleep?: (ms: number) => Promise<void>;
}

const DEFAULT_PER_ATTEMPT_TIMEOUT_MS = 10_000;
const DEFAULT_RETRY_DELAY_MS = 2_000;
const DEFAULT_MAX_ATTEMPTS = 3;

// 응답이 비었거나 형식이 잘못된 경우 던지는 예외
export class DialogueMalformedResponseError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'DialogueMalformedResponseError';
  }
}

// 모든 재시도 소진 후에도 호출 실패 시 던지는 예외
export class DialogueExhaustedError extends Error {
  public readonly attempts: number;
  public constructor(attempts: number, cause: unknown) {
    super(
      `Gpt4oDialogueAdapter exhausted after ${attempts} attempt(s): ${
        cause instanceof Error ? cause.message : String(cause)
      }`,
    );
    this.name = 'DialogueExhaustedError';
    this.attempts = attempts;
    (this as { cause?: unknown }).cause = cause;
  }
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
      reject(new Error(`Gpt4oDialogueAdapter call timed out after ${timeoutMs}ms`));
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

function unwrapResponse(
  raw: DialogueGatewayResponse | { response: DialogueGatewayResponse },
): DialogueGatewayResponse {
  if (
    typeof raw === 'object' &&
    raw !== null &&
    'response' in raw &&
    typeof (raw as { response: unknown }).response === 'object' &&
    (raw as { response: unknown }).response !== null
  ) {
    return (raw as { response: DialogueGatewayResponse }).response;
  }
  return raw as DialogueGatewayResponse;
}

function extractResponseText(response: DialogueGatewayResponse): string {
  const candidate =
    typeof response.text === 'string'
      ? response.text
      : typeof response.raw === 'string'
        ? response.raw
        : '';
  const trimmed = candidate.trim();
  if (trimmed.length === 0) {
    throw new DialogueMalformedResponseError(
      'gateway response missing non-empty text/raw field',
    );
  }
  return trimmed;
}

// `DialogueGenerator`의 GPT-4o 구현
export class Gpt4oDialogueAdapter implements DialogueGenerator {
  private readonly gateway: DialogueAIGateway;
  private readonly perAttemptTimeoutMs: number;
  private readonly retryDelayMs: number;
  private readonly maxAttempts: number;
  private readonly sleep: (ms: number) => Promise<void>;

  public constructor(options: Gpt4oDialogueAdapterOptions) {
    this.gateway = options.gateway;
    this.perAttemptTimeoutMs =
      options.perAttemptTimeoutMs ?? DEFAULT_PER_ATTEMPT_TIMEOUT_MS;
    this.retryDelayMs = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
    this.maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
    this.sleep = options.sleep ?? defaultSleep;
  }

  public async generate(
    input: DialogueGeneratorInput,
  ): Promise<DialogueGeneratorOutput> {
    const promptArgs: BuildSystemPromptArgs = {
      stage: input.stage,
      latestEmotion: input.latestEmotion,
      recentExchanges: input.recentExchanges,
      isMedicalRedirect: input.medicalDetection.isMedicalRedirect,
      ...(input.recalledDiaries !== undefined ? { recalledDiaries: input.recalledDiaries } : {}),
    };
    const systemPrompt = buildSystemPrompt(promptArgs);

    let lastError: unknown;
    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      try {
        const raw = await withTimeout(
          (signal) =>
            this.gateway.callExternalAI('gpt4o_dialogue', {
              systemPrompt,
              userText: input.userText,
              signal,
            }),
          this.perAttemptTimeoutMs,
        );
        const response = unwrapResponse(raw);
        const aiResponse = extractResponseText(response);
        return { aiResponse };
      } catch (err) {
        lastError = err;
        if (attempt < this.maxAttempts) {
          await this.sleep(this.retryDelayMs);
        }
      }
    }
    throw new DialogueExhaustedError(this.maxAttempts, lastError);
  }
}
