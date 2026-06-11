// 정서 일기 영속화 포트 (의존성 역전 인터페이스)

import type { DiaryEntry } from '@nadaum/shared';

import type { AccessPolicy } from '../artifact/ArtifactProducer.js';
import type { TransactionContext } from '../auth/ports.js';

// 페이지네이션 쿼리
export interface DiaryPageQuery {
  readonly limit: number;
  readonly offset: number;
}

// 정서 일기 저장소 포트
export interface DiaryRepository {
  insert(diary: DiaryEntry, tx?: TransactionContext): Promise<void>;
  findById(userId: string, diaryId: string): Promise<DiaryEntry | undefined>;
  listByUser(userId: string, page: DiaryPageQuery): Promise<DiaryEntry[]>;
  findRecentByUser(userId: string, limit: number): Promise<DiaryEntry[]>;
  findByDateRange(
    userId: string,
    from: string,
    to: string,
    limit: number,
  ): Promise<DiaryEntry[]>;
  updateBody(userId: string, diaryId: string, body: string): Promise<DiaryEntry | undefined>;
  delete(userId: string, diaryId: string): Promise<boolean>;
}

// 산출물 메타데이터 행
export interface ArtifactMeta {
  readonly artifactId: string;
  readonly artifactType: string;
  readonly userId: string;
  readonly sessionId: string;
  readonly recipients?: string[];
  readonly accessPolicy: AccessPolicy;
  readonly payloadRef: string;
  readonly createdAt: Date;
}

// 산출물 메타 저장소 포트
export interface ArtifactRepository {
  insert(meta: ArtifactMeta, tx?: TransactionContext): Promise<void>;
  findById(artifactId: string): Promise<ArtifactMeta | undefined>;
}
