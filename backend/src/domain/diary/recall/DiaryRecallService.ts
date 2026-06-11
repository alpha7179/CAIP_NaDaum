// 과거 일기 회상 하이브리드 조율 도메인 서비스

import { resolveDateReference } from './dateReference.js';
import { DEFAULT_RECALL_LIMIT, mergeRecall } from './mergeRecall.js';
import type { DiaryEmbedder, DiaryRecallReader } from './ports.js';
import { detectRecallTrigger } from './recallTrigger.js';
import type { RecalledDiary } from './types.js';

// DiaryRecallService 생성자 옵션
export interface DiaryRecallServiceOptions {
  readonly reader: DiaryRecallReader;
  readonly embedder?: DiaryEmbedder;
  readonly clock?: () => Date;
  readonly dateLimit?: number;
  readonly semanticK?: number;
  readonly mergeK?: number;
}

// 회상 서비스가 노출하는 최소 포트(오케스트레이터 주입용)
export interface DiaryRecallPort {
  recall(userId: string, userText: string): Promise<RecalledDiary[]>;
}

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

function toKstYmd(instant: Date): string {
  const kst = new Date(instant.getTime() + KST_OFFSET_MS);
  const y = kst.getUTCFullYear().toString().padStart(4, '0');
  const m = (kst.getUTCMonth() + 1).toString().padStart(2, '0');
  const d = kst.getUTCDate().toString().padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export class DiaryRecallService implements DiaryRecallPort {
  private readonly reader: DiaryRecallReader;
  private readonly embedder: DiaryEmbedder | undefined;
  private readonly clock: () => Date;
  private readonly dateLimit: number;
  private readonly semanticK: number;
  private readonly mergeK: number;

  public constructor(options: DiaryRecallServiceOptions) {
    this.reader = options.reader;
    this.embedder = options.embedder;
    this.clock = options.clock ?? ((): Date => new Date());
    this.dateLimit = options.dateLimit ?? 5;
    this.semanticK = options.semanticK ?? 5;
    this.mergeK = options.mergeK ?? DEFAULT_RECALL_LIMIT;
  }

  public async recall(userId: string, userText: string): Promise<RecalledDiary[]> {
    const trigger = detectRecallTrigger(userText);
    if (!trigger.triggered) {
      return [];
    }

    const today = toKstYmd(this.clock());
    const dateRef = resolveDateReference(userText, today);
    const dateHits: RecalledDiary[] = [];
    if (dateRef !== undefined) {
      try {
        const rows = await this.reader.findByDateRange(
          userId,
          dateRef.range.from,
          dateRef.range.to,
          this.dateLimit,
        );
        for (const diary of rows) {
          dateHits.push({ diary, source: 'date', score: 1 });
        }
      } catch {}
    }

    const semanticHits: RecalledDiary[] = [];
    if (this.embedder !== undefined) {
      try {
        const vector = await this.embedder.embed(userText);
        const similar = await this.reader.findSimilarByUser(userId, vector, this.semanticK);
        for (const hit of similar) {
          semanticHits.push({ diary: hit.diary, source: 'semantic', score: hit.similarity });
        }
      } catch {}
    }

    return mergeRecall(dateHits, semanticHits, this.mergeK);
  }
}
