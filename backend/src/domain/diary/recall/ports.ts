// 회상 서비스가 의존하는 의존성 역전 인터페이스

import type { DiaryEntry } from '@nadaum/shared';

// 의미 검색 결과 1건 — 회수 일기와 코사인 유사도(0~1)
export interface SimilarDiary {
  readonly diary: DiaryEntry;
  readonly similarity: number;
}

// 회상 회수 리더 포트(날짜 기반·의미 기반 회수)
export interface DiaryRecallReader {
  findByDateRange(
    userId: string,
    from: string,
    to: string,
    limit: number,
  ): Promise<DiaryEntry[]>;
  findSimilarByUser(
    userId: string,
    queryVector: readonly number[],
    k: number,
  ): Promise<SimilarDiary[]>;
}

// 의미 기반 검색 어댑터 포트(회상 RAG 확장)
export interface SemanticDiarySearch {
  searchSimilar(
    userId: string,
    queryVector: readonly number[],
    k: number,
  ): Promise<SimilarDiary[]>;
}

// 일기/발화 임베딩 포트
export interface DiaryEmbedder {
  embed(text: string): Promise<number[]>;
}
