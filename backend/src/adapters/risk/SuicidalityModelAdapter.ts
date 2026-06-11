// LLM 기반 위험도 분류기 어댑터

import type { RiskLevel } from '@nadaum/shared';

import type {
  RiskModelAssessor,
  SuicidalityModelOutput,
} from '../../domain/risk/SuicidalityModelSignal.js';

export interface RiskAIGateway {
  callExternalAI(
    target: 'gpt4o_risk',
    req: { readonly prompt: string; readonly schema: unknown; readonly signal?: AbortSignal },
  ): Promise<{ readonly raw?: string; readonly parsed?: unknown }>;
}

export interface SuicidalityModelAdapterOptions {
  readonly gateway: RiskAIGateway;
  readonly timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 5_000;

const VALID_LEVELS: ReadonlySet<RiskLevel> = new Set<RiskLevel>([
  '저위험',
  '중위험',
  '고위험',
]);

export function buildRiskPrompt(text: string): string {
  return [
    '당신은 한국어 발화에서 자살·자해·타해 위험 신호를 평가하는 분류기입니다.',
    '오타·띄어쓰기 오류·우회 표현·맥락상 암시까지 고려해 위험도를 판정하세요.',
    '진단이나 처방은 하지 말고, 위험 수준만 분류하세요.',
    '응답은 반드시 JSON 객체 한 개로만 구성하며, 다른 설명·코드블록·자연어를 포함하지 마세요.',
    'JSON 스키마:',
    '{ "level": "저위험" | "중위험" | "고위험", "score": <0-1 사이 실수> }',
    '발화:',
    text,
  ].join('\n');
}

function parseOutput(body: unknown): SuicidalityModelOutput | undefined {
  let parsed: unknown = body;
  if (typeof body === 'string') {
    try {
      parsed = JSON.parse(body);
    } catch {
      return undefined;
    }
  }
  if (typeof parsed !== 'object' || parsed === null) {
    return undefined;
  }
  const obj = parsed as Record<string, unknown>;
  const out: { level?: RiskLevel; score?: number } = {};
  if (typeof obj['level'] === 'string' && VALID_LEVELS.has(obj['level'] as RiskLevel)) {
    out.level = obj['level'] as RiskLevel;
  }
  if (typeof obj['score'] === 'number' && Number.isFinite(obj['score'])) {
    out.score = obj['score'];
  }
  if (out.level === undefined && out.score === undefined) {
    return undefined;
  }
  return out;
}

export class SuicidalityModelAdapter implements RiskModelAssessor {
  private readonly gateway: RiskAIGateway;
  private readonly timeoutMs: number;

  public constructor(options: SuicidalityModelAdapterOptions) {
    this.gateway = options.gateway;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  public async assess(text: string): Promise<SuicidalityModelOutput | undefined> {
    const trimmed = typeof text === 'string' ? text.trim() : '';
    if (trimmed.length === 0) {
      return undefined;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.gateway.callExternalAI('gpt4o_risk', {
        prompt: buildRiskPrompt(trimmed),
        schema: { level: ['저위험', '중위험', '고위험'], score: 'number(0-1)' },
        signal: controller.signal,
      });
      const body =
        response.parsed !== undefined ? response.parsed : response.raw;
      return parseOutput(body);
    } catch {
      return undefined;
    } finally {
      clearTimeout(timer);
    }
  }
}
