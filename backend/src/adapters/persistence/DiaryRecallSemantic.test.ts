// 회상 RAG 의미 검색 통합 테스트(인메모리)
import type { DiaryEntry, EmotionScores } from '@nadaum/shared';
import { describe, expect, it } from 'vitest';


import { DiaryRecallService } from '../../domain/diary/recall/DiaryRecallService.js';
import type { DiaryEmbedder } from '../../domain/diary/recall/ports.js';
import { DiaryRecallReaderAdapter } from '../diary-recall/DiaryRecallReaderAdapter.js';

import {
  InMemoryDiaryRepository,
  InMemorySemanticDiarySearch,
} from './DiaryRepository.js';

const baseScores: EmotionScores = {
  기쁨: 5, 슬픔: 5, 분노: 5, 불안: 5, 놀람: 5, 혐오: 5, 중립: 5,
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
    createdAt: new Date(`${sessionDate}T10:00:00.000Z`),
  };
}

const KEYWORDS = ['발표', '시험', '여행', '가족', '친구'] as const;
function keywordEmbed(text: string): number[] {
  return KEYWORDS.map((kw) => (text.includes(kw) ? 1 : 0));
}
class KeywordEmbedder implements DiaryEmbedder {
  public async embed(text: string): Promise<number[]> {
    return keywordEmbed(text);
  }
}

const FIXED_NOW = new Date('2026-06-11T03:00:00.000Z');

describe('회상 RAG 의미 검색(인메모리)', () => {
  it('주제가 같은 과거 일기를 의미 검색으로 회수한다', async () => {
    const repo = new InMemoryDiaryRepository();
    const semantic = new InMemorySemanticDiarySearch(repo);

    const d1 = diary('d1', '2026-05-01', '오늘 발표 준비를 끝냈다. 발표 부담이 컸지만 해냈다.');
    const d2 = diary('d2', '2026-05-10', '시험 결과가 나왔다. 시험 동안 긴장이 컸다.');
    const d3 = diary('d3', '2026-05-15', '가족과 함께한 저녁이 따뜻했다.');
    for (const d of [d1, d2, d3]) {
      await repo.insert(d);
      await repo.setEmbedding(d.userId, d.diaryId, keywordEmbed(d.body));
    }

    const svc = new DiaryRecallService({
      reader: new DiaryRecallReaderAdapter({ diaries: repo, semantic }),
      embedder: new KeywordEmbedder(),
      clock: () => FIXED_NOW,
      mergeK: 2,
    });

    const result = await svc.recall('u1', '전에 발표 얘기했잖아 그게 다시 떠올라요');
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]!.diary.diaryId).toBe('d1');
    expect(result[0]!.source).toBe('semantic');
  });

  it('날짜 표현이 함께 있으면 날짜 일치가 의미 검색보다 우선 표기된다(병합)', async () => {
    const repo = new InMemoryDiaryRepository();
    const semantic = new InMemorySemanticDiarySearch(repo);

    const yesterday = diary('y', '2026-06-10', '어제 발표가 있었다. 발표 끝나니 후련했다.');
    const old = diary('o', '2026-04-01', '예전 발표를 떠올렸다.');
    for (const d of [yesterday, old]) {
      await repo.insert(d);
      await repo.setEmbedding(d.userId, d.diaryId, keywordEmbed(d.body));
    }

    const svc = new DiaryRecallService({
      reader: new DiaryRecallReaderAdapter({ diaries: repo, semantic }),
      embedder: new KeywordEmbedder(),
      clock: () => FIXED_NOW,
      mergeK: 2,
    });

    const result = await svc.recall('u1', '어제 발표 얘기했잖아 다시 떠올라요');
    expect(result[0]!.diary.diaryId).toBe('y');
    expect(result[0]!.source).toBe('date');
  });

  it('임베딩이 없는 일기는 의미 검색에서 제외된다', async () => {
    const repo = new InMemoryDiaryRepository();
    const semantic = new InMemorySemanticDiarySearch(repo);

    const withEmb = diary('w', '2026-05-01', '발표 일기');
    const noEmb = diary('n', '2026-05-02', '발표 일기 미적재');
    await repo.insert(withEmb);
    await repo.setEmbedding(withEmb.userId, withEmb.diaryId, keywordEmbed(withEmb.body));
    await repo.insert(noEmb);

    const svc = new DiaryRecallService({
      reader: new DiaryRecallReaderAdapter({ diaries: repo, semantic }),
      embedder: new KeywordEmbedder(),
      clock: () => FIXED_NOW,
      mergeK: 5,
    });
    const result = await svc.recall('u1', '전에 발표 얘기했잖아');
    expect(result.map((r) => r.diary.diaryId)).toEqual(['w']);
  });
});
