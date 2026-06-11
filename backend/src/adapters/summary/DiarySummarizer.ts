// 일기 본문을 N줄로 요약하는 어댑터

export const SUMMARY_MIN_LINES = 1;
export const SUMMARY_MAX_LINES = 20;

export interface SummaryAIGateway {
  callExternalAI(
    target: 'gpt4o_dialogue',
    req: { systemPrompt: string; userText: string },
  ): Promise<unknown>;
}

export interface DiarySummarizerPort {
  summarize(text: string, lines: number): Promise<string>;
}

function clampLines(n: number): number {
  if (!Number.isFinite(n)) return SUMMARY_MIN_LINES;
  return Math.max(SUMMARY_MIN_LINES, Math.min(SUMMARY_MAX_LINES, Math.floor(n)));
}

function countLines(body: string): number {
  const parts = body
    .replace(/\r\n/g, '\n')
    .split(/(?<=[.!?。…])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return Math.max(SUMMARY_MIN_LINES, parts.length);
}

function buildSummaryPrompt(lines: number): string {
  return [
    '당신은 사용자가 쓴 정서 일기를 짧게 요약하는 도우미입니다.',
    `- 아래 일기를 핵심만 담아 정확히 ${lines}문장으로 요약하세요.`,
    '- 일기의 1인칭 시점과 어조를 유지하세요.',
    '- 의학적 진단·평가·조언을 하지 말고, 내용 요약만 하세요.',
    '- 줄 번호나 불릿(•, -, 1.), 줄바꿈 없이 한 문단으로 자연스럽게 이어서 출력하세요.',
  ].join('\n');
}

function extractText(raw: unknown): string {
  const r = (raw ?? {}) as { text?: unknown; raw?: unknown };
  const candidate = typeof r.text === 'string' ? r.text : typeof r.raw === 'string' ? r.raw : '';
  return candidate.trim();
}

export class DiarySummarizer implements DiarySummarizerPort {
  private readonly gateway: SummaryAIGateway;

  public constructor(options: { gateway: SummaryAIGateway }) {
    this.gateway = options.gateway;
  }

  public async summarize(text: string, lines: number): Promise<string> {
    const body = text.trim();
    if (body.length === 0) return '';
    const n = Math.min(clampLines(lines), countLines(body));

    const raw = await this.gateway.callExternalAI('gpt4o_dialogue', {
      systemPrompt: buildSummaryPrompt(n),
      userText: body,
    });
    const summary = extractText(raw);

    const oneParagraph = summary.replace(/\s*\n+\s*/g, ' ').replace(/[ \t]+/g, ' ').trim();
    const sentences = oneParagraph
      .split(/(?<=[.!?。…])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    const limited = (sentences.length > n ? sentences.slice(0, n) : sentences).join(' ');

    return limited.length > 0 ? limited : body;
  }
}
