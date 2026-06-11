// 날짜 기반과 의미 기반 회상 결과를 병합·랭킹해 상위 K개를 선택하는 순수 함수

import type { RecalledDiary } from './types.js';

export const DEFAULT_RECALL_LIMIT = 2;

export function mergeRecall(
  dateHits: readonly RecalledDiary[],
  semanticHits: readonly RecalledDiary[],
  k: number = DEFAULT_RECALL_LIMIT,
): RecalledDiary[] {
  if (k <= 0) {
    return [];
  }

  const byDiaryId = new Map<string, RecalledDiary>();

  const consider = (hit: RecalledDiary): void => {
    const existing = byDiaryId.get(hit.diary.diaryId);
    if (existing === undefined) {
      byDiaryId.set(hit.diary.diaryId, hit);
      return;
    }
    const source =
      existing.source === 'date' || hit.source === 'date' ? 'date' : 'semantic';
    byDiaryId.set(hit.diary.diaryId, {
      diary: existing.diary,
      source,
      score: Math.max(existing.score, hit.score),
    });
  };

  for (const hit of dateHits) consider(hit);
  for (const hit of semanticHits) consider(hit);

  return [...byDiaryId.values()]
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return a.diary.sessionDate < b.diary.sessionDate ? 1 : -1;
    })
    .slice(0, k);
}
