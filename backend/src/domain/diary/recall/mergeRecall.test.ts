// mergeRecall 단위 테스트
import type { DiaryEntry, EmotionScores } from '@nadaum/shared';
import { describe, expect, it } from 'vitest';


import { mergeRecall } from './mergeRecall.js';
import type { RecalledDiary } from './types.js';

const baseScores: EmotionScores = {
  기쁨: 5,
  슬픔: 5,
  분노: 5,
  불안: 5,
  놀람: 5,
  혐오: 5,
  중립: 5,
};

function diary(id: string, sessionDate: string, body = '내용'): DiaryEntry {
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

describe('mergeRecall', () => {
  it('같은 일기가 양쪽에서 회수되면 합쳐서 한 번만 반환한다', () => {
    const d = diary('d1', '2026-06-10');
    const dateHit: RecalledDiary = { diary: d, source: 'date', score: 1 };
    const semHit: RecalledDiary = { diary: d, source: 'semantic', score: 0.8 };
    const merged = mergeRecall([dateHit], [semHit], 5);
    expect(merged).toHaveLength(1);
    expect(merged[0]!.source).toBe('date');
    expect(merged[0]!.score).toBe(1);
  });

  it('점수 내림차순으로 정렬한다', () => {
    const a = diary('a', '2026-06-10');
    const b = diary('b', '2026-06-09');
    const merged = mergeRecall(
      [],
      [
        { diary: a, source: 'semantic', score: 0.6 },
        { diary: b, source: 'semantic', score: 0.9 },
      ],
      5,
    );
    expect(merged.map((m) => m.diary.diaryId)).toEqual(['b', 'a']);
  });

  it('동점은 일기 최신순(session_date DESC)으로 정렬한다', () => {
    const newer = diary('newer', '2026-06-10');
    const older = diary('older', '2026-06-01');
    const merged = mergeRecall(
      [
        { diary: older, source: 'date', score: 1 },
        { diary: newer, source: 'date', score: 1 },
      ],
      [],
      5,
    );
    expect(merged.map((m) => m.diary.diaryId)).toEqual(['newer', 'older']);
  });

  it('상한 K로 컷오프한다', () => {
    const items: RecalledDiary[] = [];
    for (let i = 0; i < 5; i += 1) {
      items.push({
        diary: diary(`d${i}`, `2026-06-${10 - i}`),
        source: 'semantic',
        score: 1 - i * 0.1,
      });
    }
    const merged = mergeRecall([], items, 2);
    expect(merged).toHaveLength(2);
    expect(merged.map((m) => m.diary.diaryId)).toEqual(['d0', 'd1']);
  });

  it('K가 0이면 빈 배열을 반환한다', () => {
    const d = diary('d1', '2026-06-10');
    expect(mergeRecall([{ diary: d, source: 'date', score: 1 }], [], 0)).toEqual([]);
  });
});
