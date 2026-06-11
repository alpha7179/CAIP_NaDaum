// DiaryQueryService 단위 테스트
import type { DiaryEntry, EmotionScores } from '@nadaum/shared';
import { describe, expect, it } from 'vitest';


import { InMemoryDiaryRepository } from '../../adapters/persistence/DiaryRepository.js';

import {
  DIARY_PAGE_SIZE,
  DiaryQueryService,
} from './DiaryQueryService.js';

const scores: EmotionScores = {
  기쁨: 5,
  슬픔: 5,
  분노: 5,
  불안: 5,
  놀람: 5,
  혐오: 5,
  중립: 5,
};

function diary(i: number, userId = 'user-1'): DiaryEntry {
  const day = String(i + 1).padStart(2, '0');
  return {
    diaryId: `d-${userId}-${i}`,
    userId,
    sessionId: `s-${i}`,
    sessionDate: `2026-05-${day}`,
    title: `제목 ${i}`,
    tags: [`태그${i}`],
    bodyType: 'brief',
    body: `일기 ${i}`,
    emotionScores: { ...scores, 슬픔: (i % 10) + 1 },
    peakRiskLevel: '저위험',
    createdAt: new Date(`2026-05-${day}T10:00:00.000Z`),
  };
}

async function seed(count: number, userId = 'user-1'): Promise<DiaryQueryService> {
  const repo = new InMemoryDiaryRepository();
  for (let i = 0; i < count; i += 1) {
    await repo.insert(diary(i, userId));
  }
  return new DiaryQueryService(repo);
}

describe('DiaryQueryService.list', () => {
  it('returns up to 10 items, latest first, with hasNext when more exist', async () => {
    const svc = await seed(12);
    const page0 = await svc.list('user-1', 0);
    expect(page0.items).toHaveLength(DIARY_PAGE_SIZE);
    expect(page0.hasNext).toBe(true);
    expect(page0.items[0]?.diaryId).toBe('d-user-1-11');
  });

  it('last page has hasNext=false', async () => {
    const svc = await seed(12);
    const page1 = await svc.list('user-1', 1);
    expect(page1.items).toHaveLength(2);
    expect(page1.hasNext).toBe(false);
  });

  it('returns empty page when there are no diaries', async () => {
    const svc = await seed(0);
    const page0 = await svc.list('user-1', 0);
    expect(page0.items).toHaveLength(0);
    expect(page0.hasNext).toBe(false);
  });
});

describe('DiaryQueryService.getById', () => {
  it('returns the diary for the owner', async () => {
    const svc = await seed(3);
    expect((await svc.getById('user-1', 'd-user-1-1'))?.body).toBe('일기 1');
  });

  it('does not expose another user diary', async () => {
    const repo = new InMemoryDiaryRepository();
    await repo.insert(diary(0, 'user-1'));
    await repo.insert(diary(0, 'user-2'));
    const svc = new DiaryQueryService(repo);
    expect(await svc.getById('user-1', 'd-user-2-0')).toBeUndefined();
  });
});

describe('DiaryQueryService.getRecentTrend', () => {
  it('returns up to N points in chronological order (oldest first)', async () => {
    const svc = await seed(10);
    const trend = await svc.getRecentTrend('user-1', 7);
    expect(trend.points).toHaveLength(7);
    const dates = trend.points.map((p) => p.sessionDate);
    const sorted = [...dates].sort();
    expect(dates).toEqual(sorted);
  });

  it('returns fewer than 7 when not enough diaries', async () => {
    const svc = await seed(3);
    const trend = await svc.getRecentTrend('user-1');
    expect(trend.points).toHaveLength(3);
  });

  it('returns empty trend for a user with no diaries', async () => {
    const svc = await seed(0);
    const trend = await svc.getRecentTrend('user-1');
    expect(trend.points).toHaveLength(0);
  });
});
