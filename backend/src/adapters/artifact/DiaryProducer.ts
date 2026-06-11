// DiaryProducer — GPT-4o 기반 정서 일기 생성 산출물 어댑터

import {
  DIARY_FULL_BODY_MAX_LENGTH,
  DIARY_FULL_BODY_MIN_LENGTH,
  DIARY_FULL_MIN_USER_UTTERANCES,
  DIARY_MAX_TAGS,
  DIARY_TAG_MAX_LENGTH,
  DIARY_TITLE_MAX_LENGTH,
  type DiaryBodyType,
  type DiaryEntry,
  type EmotionScores,
  type Exchange,
  type RiskLevel,
  type RiskTrajectoryPoint,
} from '@nadaum/shared';

import type { ArtifactProducer } from '../../domain/artifact/ArtifactProducer.js';
import type { SessionResult } from '../../domain/artifact/SessionResult.js';
import { sanitize, selectDominantEmotion } from '../../domain/artifact/diary/sanitize.js';
import { maxRiskLevel } from '../../domain/risk/RiskDecisionFunction.js';

// 단일 GPT-4o 일기 생성 호출 요청
export interface DiaryGatewayRequest {
  readonly prompt: string;
  readonly signal?: AbortSignal;
}

// GPT-4o 일기 생성 호출 응답
export interface DiaryGatewayResponse {
  readonly text?: string;
  readonly raw?: string;
}

// DiaryProducer가 의존하는 최소 AIGateway 포트
export interface DiaryAIGateway {
  callExternalAI(
    target: 'gpt4o_diary',
    req: DiaryGatewayRequest,
  ): Promise<DiaryGatewayResponse | { response: DiaryGatewayResponse }>;
}

// DiaryProducer 생성자 옵션
export interface DiaryProducerOptions {
  readonly gateway: DiaryAIGateway;
  readonly idFactory: () => string;
  readonly clock?: () => Date;
  readonly perAttemptTimeoutMs?: number;
  readonly retryDelayMs?: number;
  readonly maxAttempts?: number;
  readonly sleep?: (ms: number) => Promise<void>;
}

const DEFAULT_PER_ATTEMPT_TIMEOUT_MS = 30_000;
const DEFAULT_RETRY_DELAY_MS = 2_000;
const DEFAULT_MAX_ATTEMPTS = 3;

const ARTIFACT_TYPE = 'emotion_diary';

// 일기 생성이 모든 재시도 후에도 비어 있는 응답만 받은 경우 던지는 예외
export class DiaryProductionError extends Error {
  public readonly attempts: number;
  public constructor(attempts: number, cause: unknown) {
    super(
      `DiaryProducer failed after ${attempts} attempt(s): ${
        cause instanceof Error ? cause.message : String(cause)
      }`,
    );
    this.name = 'DiaryProductionError';
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
      reject(new Error(`DiaryProducer call timed out after ${timeoutMs}ms`));
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
  raw: DiaryGatewayResponse | { response: DiaryGatewayResponse },
): DiaryGatewayResponse {
  if (
    typeof raw === 'object' &&
    raw !== null &&
    'response' in raw &&
    typeof (raw as { response: unknown }).response === 'object' &&
    (raw as { response: unknown }).response !== null
  ) {
    return (raw as { response: DiaryGatewayResponse }).response;
  }
  return raw as DiaryGatewayResponse;
}

function extractBody(response: DiaryGatewayResponse): string {
  const candidate =
    typeof response.text === 'string'
      ? response.text
      : typeof response.raw === 'string'
        ? response.raw
        : '';
  return candidate.trim();
}

function clampTitle(raw: string): string {
  const cleaned = raw
    .replace(/^["'「『“”\s]+/, '')
    .replace(/["'」』“”.。!?\s]+$/, '')
    .trim();
  return cleaned.length > DIARY_TITLE_MAX_LENGTH
    ? cleaned.slice(0, DIARY_TITLE_MAX_LENGTH)
    : cleaned;
}

function deriveTitleFromBody(body: string): string {
  const first = body.split(/[.!?。\n]/)[0]?.trim() ?? '';
  return clampTitle(first) || '오늘의 기록';
}

function parseTags(raw: string): string[] {
  const out: string[] = [];
  for (const piece of raw.split(/[#,\n]/)) {
    const tag = piece.replace(/^["'「『\s]+/, '').replace(/["'」』\s]+$/, '').trim();
    if (tag.length === 0) continue;
    const clipped = tag.length > DIARY_TAG_MAX_LENGTH ? tag.slice(0, DIARY_TAG_MAX_LENGTH) : tag;
    if (!out.includes(clipped)) out.push(clipped);
    if (out.length >= DIARY_MAX_TAGS) break;
  }
  return out;
}

function parseDiaryResponse(text: string): { title: string; tags: string[]; body: string } {
  const titleMatch = /^\s*제목\s*[:：]\s*(.+)$/m.exec(text);
  const tagsMatch = /^\s*태그\s*[:：]\s*(.+)$/m.exec(text);
  const bodyMarker = /본문\s*[:：]\s*/.exec(text);
  const title = titleMatch?.[1] !== undefined ? clampTitle(titleMatch[1]) : '';
  const tags = tagsMatch?.[1] !== undefined ? parseTags(tagsMatch[1]) : [];

  let body: string;
  if (bodyMarker && bodyMarker.index !== undefined) {
    body = text.slice(bodyMarker.index + bodyMarker[0].length).trim();
  } else {
    body = text;
    if (titleMatch) body = body.replace(titleMatch[0], '');
    if (tagsMatch) body = body.replace(tagsMatch[0], '');
    body = body.trim();
  }
  return { title, tags, body };
}

function countUserUtterances(exchanges: ReadonlyArray<Exchange>): number {
  return exchanges.filter((ex) => ex.role === 'user').length;
}

function toSessionDate(endedAt: Date): string {
  return endedAt.toISOString().slice(0, 10);
}

export function buildDiaryPrompt(
  session: SessionResult,
  bodyType: DiaryBodyType,
): string {
  const transcript = session.exchanges
    .map((ex) => `${ex.role === 'user' ? '사용자' : 'AI'}: ${ex.text.replace(/\r?\n+/g, ' ').trim()}`)
    .join('\n');

  const lengthGuidance =
    bodyType === 'full'
      ? `본문은 ${DIARY_FULL_BODY_MIN_LENGTH}자 이상 ${DIARY_FULL_BODY_MAX_LENGTH}자 이하의 1인칭 회고체 이야기로 작성하세요.`
      : '본문은 2-4문장의 간략한 1인칭 감정 요약으로 작성하세요.';

  return [
    '당신은 사용자의 대화를 바탕으로 따뜻한 정서 일기를 작성하는 도우미입니다.',
    '아래 원칙을 반드시 지키세요:',
    '- 사용자의 시점에서 1인칭("나는 ...")으로 작성합니다.',
    '- 의학적 진단·약물·치료 처방을 언급하지 않습니다(비의료 서비스).',
    '- 극단적·폭력적 표현은 부드럽게 순화하되, 느꼈던 감정 자체는 보존합니다.',
    '- 대화에 없던 사실을 지어내지 않습니다.',
    `- ${lengthGuidance}`,
    `- 제목은 그날의 감정과 핵심을 담은 ${DIARY_TITLE_MAX_LENGTH}자 이하의 짧은 한 줄로 짓습니다. 따옴표·마침표·해시태그 없이, 명사구나 짧은 구절로 자연스럽게 작성하세요.`,
    `- 태그는 그날의 핵심 키워드를 담은 해시태그를 ${DIARY_MAX_TAGS}개 이하로 만듭니다. 각 태그는 '#'으로 시작하고 공백 없이 ${DIARY_TAG_MAX_LENGTH}자 이하로, 대화에 실제로 드러난 소재·감정만 사용하세요.`,
    '',
    '다음 형식 그대로만 출력하세요(머리말·설명·코드블록 금지):',
    '제목: <제목>',
    '태그: #키워드1 #키워드2 #키워드3',
    '본문: <일기 본문>',
    '',
    '대화 원문:',
    transcript,
  ].join('\n');
}

// ArtifactProducer<DiaryEntry>의 GPT-4o 구현
export class DiaryProducer implements ArtifactProducer<DiaryEntry> {
  public readonly artifactType = ARTIFACT_TYPE;

  private readonly gateway: DiaryAIGateway;
  private readonly idFactory: () => string;
  private readonly clock: () => Date;
  private readonly perAttemptTimeoutMs: number;
  private readonly retryDelayMs: number;
  private readonly maxAttempts: number;
  private readonly sleep: (ms: number) => Promise<void>;

  public constructor(options: DiaryProducerOptions) {
    this.gateway = options.gateway;
    this.idFactory = options.idFactory;
    this.clock = options.clock ?? ((): Date => new Date());
    this.perAttemptTimeoutMs =
      options.perAttemptTimeoutMs ?? DEFAULT_PER_ATTEMPT_TIMEOUT_MS;
    this.retryDelayMs = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
    this.maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
    this.sleep = options.sleep ?? defaultSleep;
  }

  public async produce(session: SessionResult): Promise<DiaryEntry> {
    const userUtterances = countUserUtterances(session.exchanges);
    const bodyType: DiaryBodyType =
      userUtterances >= DIARY_FULL_MIN_USER_UTTERANCES ? 'full' : 'brief';
    const emotionScores: EmotionScores = {
      ...session.cumulativeEmotion.combinedScores,
    };
    const dominantEmotion = selectDominantEmotion(emotionScores);
    const peakRiskLevel = computePeakRiskLevel(session.riskTrajectory);
    const prompt = buildDiaryPrompt(session, bodyType);

    let lastBody = '';
    let lastTitle = '';
    let lastTags: string[] = [];
    let lastError: unknown;
    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      try {
        const raw = await withTimeout(
          (signal) => this.gateway.callExternalAI('gpt4o_diary', { prompt, signal }),
          this.perAttemptTimeoutMs,
        );
        const parsed = parseDiaryResponse(extractBody(unwrapResponse(raw)));
        const body = sanitize(parsed.body, dominantEmotion);
        if (body.length === 0) {
          throw new Error('empty diary body');
        }
        const title = parsed.title.length > 0 ? parsed.title : deriveTitleFromBody(body);
        lastBody = body;
        lastTitle = title;
        lastTags = parsed.tags;
        if (bodyType === 'full' && !isFullLengthValid(body) && attempt < this.maxAttempts) {
          await this.sleep(this.retryDelayMs);
          continue;
        }
        return this.assemble(session, bodyType, emotionScores, peakRiskLevel, title, parsed.tags, body);
      } catch (err) {
        lastError = err;
        if (attempt < this.maxAttempts) {
          await this.sleep(this.retryDelayMs);
        }
      }
    }

    if (lastBody.length > 0) {
      return this.assemble(session, bodyType, emotionScores, peakRiskLevel, lastTitle, lastTags, lastBody);
    }
    throw new DiaryProductionError(this.maxAttempts, lastError);
  }

  private assemble(
    session: SessionResult,
    bodyType: DiaryBodyType,
    emotionScores: EmotionScores,
    peakRiskLevel: RiskLevel,
    title: string,
    tags: string[],
    body: string,
  ): DiaryEntry {
    return {
      diaryId: this.idFactory(),
      userId: session.userId,
      sessionId: session.sessionId,
      sessionDate: toSessionDate(session.endedAt),
      title,
      tags,
      bodyType,
      body,
      emotionScores,
      peakRiskLevel,
      createdAt: this.clock(),
    };
  }
}

function computePeakRiskLevel(
  trajectory: ReadonlyArray<RiskTrajectoryPoint>,
): RiskLevel {
  let peak: RiskLevel = '저위험';
  for (const point of trajectory) {
    peak = maxRiskLevel(peak, point.level);
  }
  return peak;
}

function isFullLengthValid(body: string): boolean {
  return (
    body.length >= DIARY_FULL_BODY_MIN_LENGTH && body.length <= DIARY_FULL_BODY_MAX_LENGTH
  );
}
