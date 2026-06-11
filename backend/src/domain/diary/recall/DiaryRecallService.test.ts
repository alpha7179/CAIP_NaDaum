// DiaryRecallService 단위 테스트
import type { DiaryEntry, EmotionScores } from '@nadaum/shared';
import { describe, expect, it } from 'vitest';


import { DiaryRecallService } from './DiaryRecallService.js';
import type { DiaryEmbedder, DiaryRecallReader, SimilarDiary } from './ports.js';

const baseScores: EmotionScores = {
  기쁨: 5,
  슬픔: 5,
  분노: 5,
  불안: 5,
  놀람: 5,
  혐오: 5,
  중립: 5,
};

function diary(id: string, sessionDate: string, body: string): DiaryEntry {
  return {
    diaryId: id,
    userId: 'u1',
    sessionId: `s-${id}`,
    sessionDate,
    title: id,
    tags: [],
    bodyType: 'brief',
    body,
    emotionScores: { ...baseScores },
    peakRiskLevel: '저위험',
    createdAt: new Date(`${sessionDate}T10:00:00.000Z`),
  };
}

class FakeReader implements DiaryRecallReader {
  public dateCalls: Array<{ from: string; to: string }> = [];
  public semanticCalls = 0;
  public constructor(
    private readonly dateRows: DiaryEntry[],
    private readonly semanticRows: SimilarDiary[] = [],
  ) {}
  public async findByDateRange(
    _userId: string,
    from: string,
    to: string,
    _limit: number,
  ): Promise<DiaryEntry[]> {
    this.dateCalls.push({ from, to });
    return this.dateRows;
  }
  public async findSimilarByUser(
    _userId: string,
    _q: readonly number[],
    _k: number,
  ): Promise<SimilarDiary[]> {
    this.semanticCalls += 1;
    return this.semanticRows;
  }
}

class FakeEmbedder implements DiaryEmbedder {
  public calls = 0;
  public async embed(_text: string): Promise<number[]> {
    this.calls += 1;
    return [0.1, 0.2, 0.3];
  }
}

const FIXED_NOW = new Date('2026-06-11T03:00:00.000Z');

describe('DiaryRecallService', () => {
  it('회상 트리거가 없으면 외부 호출 없이 빈 배열을 반환한다', async () => {
    const reader = new FakeReader([]);
    const embedder = new FakeEmbedder();
    const svc = new DiaryRecallService({ reader, embedder, clock: () => FIXED_NOW });
    const result = await svc.recall('u1', '오늘 기분이 가라앉아요');
    expect(result).toEqual([]);
    expect(reader.dateCalls).toHaveLength(0);
    expect(reader.semanticCalls).toBe(0);
    expect(embedder.calls).toBe(0);
  });

  it('"어제" 발화는 어제 날짜로 정확 조회한다(임베더 미주입 시 A만 동작)', async () => {
    const yesterday = diary('d1', '2026-06-10', '어제 일기');
    const reader = new FakeReader([yesterday]);
    const svc = new DiaryRecallService({ reader, clock: () => FIXED_NOW });
    const result = await svc.recall('u1', '어제 했던 그 얘기 떠올라요');
    expect(reader.dateCalls).toEqual([{ from: '2026-06-10', to: '2026-06-10' }]);
    expect(result).toHaveLength(1);
    expect(result[0]!.diary.diaryId).toBe('d1');
    expect(result[0]!.source).toBe('date');
    expect(reader.semanticCalls).toBe(0);
  });

  it('임베더가 주입되면 의미 검색도 수행해 병합된다', async () => {
    const dateHit = diary('d1', '2026-06-10', '어제 일기');
    const semHit = diary('d2', '2026-05-30', '비슷한 주제 일기');
    const reader = new FakeReader(
      [dateHit],
      [{ diary: semHit, similarity: 0.85 }],
    );
    const embedder = new FakeEmbedder();
    const svc = new DiaryRecallService({
      reader,
      embedder,
      clock: () => FIXED_NOW,
      mergeK: 5,
    });
    const result = await svc.recall('u1', '어제 그 얘기 떠올라요');
    expect(embedder.calls).toBe(1);
    expect(reader.semanticCalls).toBe(1);
    const ids = result.map((r) => r.diary.diaryId);
    expect(ids).toEqual(expect.arrayContaining(['d1', 'd2']));
    expect(result[0]!.diary.diaryId).toBe('d1');
    expect(result[0]!.source).toBe('date');
  });

  it('임베더 실패는 흡수하고 날짜 결과만 반환한다(대화를 막지 않는다)', async () => {
    const dateHit = diary('d1', '2026-06-10', '어제 일기');
    const reader = new FakeReader([dateHit]);
    const embedder: DiaryEmbedder = {
      async embed(): Promise<number[]> {
        throw new Error('embedding service down');
      },
    };
    const svc = new DiaryRecallService({ reader, embedder, clock: () => FIXED_NOW });
    const result = await svc.recall('u1', '어제 그 얘기 떠올라요');
    expect(result).toHaveLength(1);
    expect(result[0]!.diary.diaryId).toBe('d1');
  });

  it('모호한 표현(며칠 전)은 날짜 호출을 건너뛰고 의미 검색만 시도한다', async () => {
    const semHit = diary('d3', '2026-05-20', '관련 주제');
    const reader = new FakeReader([], [{ diary: semHit, similarity: 0.7 }]);
    const embedder = new FakeEmbedder();
    const svc = new DiaryRecallService({ reader, embedder, clock: () => FIXED_NOW });
    const result = await svc.recall('u1', '며칠 전 그 얘기 다시 떠올랐어요');
    expect(reader.dateCalls).toHaveLength(0);
    expect(reader.semanticCalls).toBe(1);
    expect(result.map((r) => r.diary.diaryId)).toEqual(['d3']);
    expect(result[0]!.source).toBe('semantic');
  });
});
