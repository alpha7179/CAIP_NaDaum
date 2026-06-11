// DiaryRepository 어댑터 — diary_entries 테이블 영속화

import type { DiaryEntry, EmotionScores, RiskLevel } from '@nadaum/shared';
import type { Pool } from 'pg';


import type { TransactionContext } from '../../domain/auth/ports.js';
import type {
  DiaryPageQuery,
  DiaryRepository,
} from '../../domain/diary/ports.js';
import type {
  SemanticDiarySearch,
  SimilarDiary,
} from '../../domain/diary/recall/ports.js';

import { getQuerier } from './PgTransactionRunner.js';

export interface DiaryEmbeddingPersistence {
  setEmbedding(
    userId: string,
    diaryId: string,
    vector: readonly number[],
    tx?: TransactionContext,
  ): Promise<void>;
}

interface DiaryRow {
  diary_id: string;
  user_id: string;
  session_id: string;
  session_date: string;
  title: string;
  tags: string[];
  body_type: 'full' | 'brief';
  body: string;
  emotion_joy: number;
  emotion_sadness: number;
  emotion_anger: number;
  emotion_anxiety: number;
  emotion_surprise: number;
  emotion_disgust: number;
  emotion_neutral: number;
  peak_risk_level: RiskLevel;
  created_at: Date;
}

const SELECT_COLUMNS = `
  diary_id, user_id, session_id, session_date::text AS session_date, title, tags, body_type, body,
  emotion_joy, emotion_sadness, emotion_anger, emotion_anxiety,
  emotion_surprise, emotion_disgust, emotion_neutral, peak_risk_level, created_at
`;

function rowToDiary(row: DiaryRow): DiaryEntry {
  const emotionScores: EmotionScores = {
    기쁨: row.emotion_joy,
    슬픔: row.emotion_sadness,
    분노: row.emotion_anger,
    불안: row.emotion_anxiety,
    놀람: row.emotion_surprise,
    혐오: row.emotion_disgust,
    중립: row.emotion_neutral,
  };
  return {
    diaryId: row.diary_id,
    userId: row.user_id,
    sessionId: row.session_id,
    sessionDate: row.session_date,
    title: row.title,
    tags: row.tags ?? [],
    bodyType: row.body_type,
    body: row.body,
    emotionScores,
    peakRiskLevel: row.peak_risk_level,
    createdAt: row.created_at,
  };
}

export class PgDiaryRepository implements DiaryRepository, DiaryEmbeddingPersistence {
  public constructor(private readonly pool: Pool) {}

  public async insert(diary: DiaryEntry, tx?: TransactionContext): Promise<void> {
    const q = getQuerier(this.pool, tx);
    const s = diary.emotionScores;
    await q.query(
      `INSERT INTO diary_entries
         (diary_id, user_id, session_id, session_date, title, tags, body_type, body,
          emotion_joy, emotion_sadness, emotion_anger, emotion_anxiety,
          emotion_surprise, emotion_disgust, emotion_neutral, peak_risk_level, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
      [
        diary.diaryId,
        diary.userId,
        diary.sessionId,
        diary.sessionDate,
        diary.title,
        diary.tags,
        diary.bodyType,
        diary.body,
        s.기쁨,
        s.슬픔,
        s.분노,
        s.불안,
        s.놀람,
        s.혐오,
        s.중립,
        diary.peakRiskLevel,
        diary.createdAt,
      ],
    );
  }

  public async findById(
    userId: string,
    diaryId: string,
  ): Promise<DiaryEntry | undefined> {
    const result = await this.pool.query<DiaryRow>(
      `SELECT ${SELECT_COLUMNS} FROM diary_entries
        WHERE user_id = $1 AND diary_id = $2 LIMIT 1`,
      [userId, diaryId],
    );
    const row = result.rows[0];
    return row === undefined ? undefined : rowToDiary(row);
  }

  public async listByUser(
    userId: string,
    page: DiaryPageQuery,
  ): Promise<DiaryEntry[]> {
    const result = await this.pool.query<DiaryRow>(
      `SELECT ${SELECT_COLUMNS} FROM diary_entries
        WHERE user_id = $1
        ORDER BY session_date DESC, created_at DESC
        LIMIT $2 OFFSET $3`,
      [userId, page.limit, page.offset],
    );
    return result.rows.map(rowToDiary);
  }

  public async findRecentByUser(
    userId: string,
    limit: number,
  ): Promise<DiaryEntry[]> {
    const result = await this.pool.query<DiaryRow>(
      `SELECT ${SELECT_COLUMNS} FROM diary_entries
        WHERE user_id = $1
        ORDER BY session_date DESC, created_at DESC
        LIMIT $2`,
      [userId, limit],
    );
    return result.rows.map(rowToDiary);
  }

  public async findByDateRange(
    userId: string,
    from: string,
    to: string,
    limit: number,
  ): Promise<DiaryEntry[]> {
    const result = await this.pool.query<DiaryRow>(
      `SELECT ${SELECT_COLUMNS} FROM diary_entries
        WHERE user_id = $1
          AND session_date BETWEEN $2::date AND $3::date
        ORDER BY session_date DESC, created_at DESC
        LIMIT $4`,
      [userId, from, to, limit],
    );
    return result.rows.map(rowToDiary);
  }

  public async updateBody(
    userId: string,
    diaryId: string,
    body: string,
  ): Promise<DiaryEntry | undefined> {
    const result = await this.pool.query<DiaryRow>(
      `UPDATE diary_entries SET body = $3
        WHERE user_id = $1 AND diary_id = $2
        RETURNING ${SELECT_COLUMNS}`,
      [userId, diaryId, body],
    );
    const row = result.rows[0];
    return row === undefined ? undefined : rowToDiary(row);
  }

  public async delete(userId: string, diaryId: string): Promise<boolean> {
    const result = await this.pool.query(
      `DELETE FROM diary_entries WHERE user_id = $1 AND diary_id = $2`,
      [userId, diaryId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  public async setEmbedding(
    userId: string,
    diaryId: string,
    vector: readonly number[],
    tx?: TransactionContext,
  ): Promise<void> {
    if (vector.length === 0) return;
    const q = getQuerier(this.pool, tx);
    const literal = `[${vector.join(',')}]`;
    await q.query(
      `UPDATE diary_entries
          SET embedding = $3::vector
        WHERE user_id = $1 AND diary_id = $2`,
      [userId, diaryId, literal],
    );
  }
}

export class PgSemanticDiarySearch implements SemanticDiarySearch {
  public constructor(private readonly pool: Pool) {}

  public async searchSimilar(
    userId: string,
    queryVector: readonly number[],
    k: number,
  ): Promise<SimilarDiary[]> {
    if (queryVector.length === 0 || k <= 0) {
      return [];
    }
    const literal = `[${queryVector.join(',')}]`;
    const result = await this.pool.query<DiaryRow & { distance: number }>(
      `SELECT ${SELECT_COLUMNS}, (embedding <=> $2::vector) AS distance
         FROM diary_entries
        WHERE user_id = $1 AND embedding IS NOT NULL
        ORDER BY embedding <=> $2::vector
        LIMIT $3`,
      [userId, literal, k],
    );
    return result.rows.map((row) => ({
      diary: rowToDiary(row),
      similarity: clamp01(1 - Number(row.distance)),
    }));
  }
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

export class InMemoryDiaryRepository implements DiaryRepository, DiaryEmbeddingPersistence {
  private readonly store: DiaryEntry[] = [];
  private readonly embeddings: Map<string, number[]> = new Map();

  public async insert(diary: DiaryEntry): Promise<void> {
    this.store.push({ ...diary, emotionScores: { ...diary.emotionScores } });
  }

  public async findById(
    userId: string,
    diaryId: string,
  ): Promise<DiaryEntry | undefined> {
    return this.store.find((d) => d.userId === userId && d.diaryId === diaryId);
  }

  public async listByUser(
    userId: string,
    page: DiaryPageQuery,
  ): Promise<DiaryEntry[]> {
    return this.sortedByUser(userId).slice(page.offset, page.offset + page.limit);
  }

  public async findRecentByUser(
    userId: string,
    limit: number,
  ): Promise<DiaryEntry[]> {
    return this.sortedByUser(userId).slice(0, Math.max(0, limit));
  }

  public async findByDateRange(
    userId: string,
    from: string,
    to: string,
    limit: number,
  ): Promise<DiaryEntry[]> {
    return this.sortedByUser(userId)
      .filter((d) => d.sessionDate >= from && d.sessionDate <= to)
      .slice(0, Math.max(0, limit));
  }

  public async updateBody(
    userId: string,
    diaryId: string,
    body: string,
  ): Promise<DiaryEntry | undefined> {
    const found = this.store.find((d) => d.userId === userId && d.diaryId === diaryId);
    if (found === undefined) return undefined;
    found.body = body;
    return { ...found, emotionScores: { ...found.emotionScores } };
  }

  public async delete(userId: string, diaryId: string): Promise<boolean> {
    const idx = this.store.findIndex((d) => d.userId === userId && d.diaryId === diaryId);
    if (idx < 0) return false;
    this.store.splice(idx, 1);
    this.embeddings.delete(`${userId}:${diaryId}`);
    return true;
  }

  public async setEmbedding(
    userId: string,
    diaryId: string,
    vector: readonly number[],
  ): Promise<void> {
    if (vector.length === 0) return;
    const found = this.store.find((d) => d.userId === userId && d.diaryId === diaryId);
    if (found === undefined) return;
    this.embeddings.set(`${userId}:${diaryId}`, [...vector]);
  }

  public getEmbedding(userId: string, diaryId: string): number[] | undefined {
    return this.embeddings.get(`${userId}:${diaryId}`);
  }

  public listEmbeddings(userId: string): Array<{ diary: DiaryEntry; vector: number[] }> {
    return this.store
      .filter((d) => d.userId === userId)
      .map((d) => {
        const v = this.embeddings.get(`${userId}:${d.diaryId}`);
        return v === undefined ? undefined : { diary: d, vector: v };
      })
      .filter((x): x is { diary: DiaryEntry; vector: number[] } => x !== undefined);
  }

  private sortedByUser(userId: string): DiaryEntry[] {
    return this.store
      .filter((d) => d.userId === userId)
      .sort((a, b) => {
        if (a.sessionDate !== b.sessionDate) {
          return a.sessionDate < b.sessionDate ? 1 : -1;
        }
        return b.createdAt.getTime() - a.createdAt.getTime();
      });
  }
}

export class InMemorySemanticDiarySearch implements SemanticDiarySearch {
  public constructor(private readonly source: InMemoryDiaryRepository) {}

  public async searchSimilar(
    userId: string,
    queryVector: readonly number[],
    k: number,
  ): Promise<SimilarDiary[]> {
    if (queryVector.length === 0 || k <= 0) return [];
    const items = this.source.listEmbeddings(userId);
    const ranked = items
      .map(({ diary, vector }) => ({
        diary,
        similarity: cosineSimilarity(queryVector, vector),
      }))
      .filter((x) => Number.isFinite(x.similarity))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, k);
    return ranked;
  }
}

function cosineSimilarity(a: readonly number[], b: readonly number[]): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }
  if (normA === 0 || normB === 0) return 0;
  const sim = dot / (Math.sqrt(normA) * Math.sqrt(normB));
  if (!Number.isFinite(sim)) return 0;
  if (sim < 0) return 0;
  if (sim > 1) return 1;
  return sim;
}
