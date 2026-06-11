// DiaryRepository를 회상 회수 포트로 변환하는 어댑터

import type { DiaryEntry } from '@nadaum/shared';

import type { DiaryRepository } from '../../domain/diary/ports.js';
import type {
  DiaryRecallReader,
  SemanticDiarySearch,
  SimilarDiary,
} from '../../domain/diary/recall/ports.js';

export interface DiaryRecallReaderAdapterOptions {
  readonly diaries: DiaryRepository;
  readonly semantic?: SemanticDiarySearch;
}

export class DiaryRecallReaderAdapter implements DiaryRecallReader {
  private readonly diaries: DiaryRepository;
  private readonly semantic: SemanticDiarySearch | undefined;

  public constructor(options: DiaryRecallReaderAdapterOptions) {
    this.diaries = options.diaries;
    this.semantic = options.semantic;
  }

  public findByDateRange(
    userId: string,
    from: string,
    to: string,
    limit: number,
  ): Promise<DiaryEntry[]> {
    return this.diaries.findByDateRange(userId, from, to, limit);
  }

  public async findSimilarByUser(
    userId: string,
    queryVector: readonly number[],
    k: number,
  ): Promise<SimilarDiary[]> {
    if (this.semantic === undefined) {
      return [];
    }
    return this.semantic.searchSimilar(userId, queryVector, k);
  }
}
