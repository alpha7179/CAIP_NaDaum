// 일기 열람·감정 추이 조회 도메인 서비스

import type { DiaryEntry, EmotionScores } from '@nadaum/shared';

import type { DiaryRepository } from '../diary/ports.js';

export const DIARY_PAGE_SIZE = 10;

export const DEFAULT_TREND_SESSION_LIMIT = 7;

// 일기 목록 페이지 결과
export interface DiaryListPage {
  readonly items: DiaryEntry[];
  readonly page: number;
  readonly hasNext: boolean;
}

// 감정 추이의 단일 지점(세션 단위)
export interface EmotionTrendPoint {
  readonly diaryId: string;
  readonly sessionDate: string;
  readonly scores: EmotionScores;
}

// 감정 추이 결과 — 오래된→최신 시간순
export interface EmotionTrend {
  readonly points: EmotionTrendPoint[];
}

export class DiaryQueryService {
  public constructor(private readonly diaries: DiaryRepository) {}

  public async list(userId: string, page = 0): Promise<DiaryListPage> {
    const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 0;
    const offset = safePage * DIARY_PAGE_SIZE;
    const rows = await this.diaries.listByUser(userId, {
      limit: DIARY_PAGE_SIZE + 1,
      offset,
    });
    const hasNext = rows.length > DIARY_PAGE_SIZE;
    const items = hasNext ? rows.slice(0, DIARY_PAGE_SIZE) : rows;
    return { items, page: safePage, hasNext };
  }

  public async getById(
    userId: string,
    diaryId: string,
  ): Promise<DiaryEntry | undefined> {
    return this.diaries.findById(userId, diaryId);
  }

  public async updateBody(
    userId: string,
    diaryId: string,
    body: string,
  ): Promise<DiaryEntry | undefined> {
    if (typeof body !== 'string' || body.trim().length === 0) return undefined;
    return this.diaries.updateBody(userId, diaryId, body);
  }

  public async deleteById(userId: string, diaryId: string): Promise<boolean> {
    return this.diaries.delete(userId, diaryId);
  }

  public async getRecentTrend(
    userId: string,
    sessionLimit = DEFAULT_TREND_SESSION_LIMIT,
  ): Promise<EmotionTrend> {
    const limit =
      Number.isFinite(sessionLimit) && sessionLimit > 0
        ? Math.floor(sessionLimit)
        : DEFAULT_TREND_SESSION_LIMIT;
    const recent = await this.diaries.findRecentByUser(userId, limit);
    const points: EmotionTrendPoint[] = recent
      .slice()
      .reverse()
      .map((d) => ({
        diaryId: d.diaryId,
        sessionDate: d.sessionDate,
        scores: d.emotionScores,
      }));
    return { points };
  }
}
