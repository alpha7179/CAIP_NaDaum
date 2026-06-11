// DiaryRepository / ArtifactRepository 어댑터 테스트
import type { DiaryEntry, EmotionScores } from '@nadaum/shared';
import { describe, expect, it } from 'vitest';


import type { ArtifactMeta } from '../../domain/diary/ports.js';

import {
  InMemoryArtifactRepository,
  PgArtifactRepository,
} from './ArtifactRepository.js';
import {
  InMemoryDiaryRepository,
  PgDiaryRepository,
} from './DiaryRepository.js';
import { PgTransactionRunner } from './PgTransactionRunner.js';
import { createFakePool } from './__fakes__/fake-pool.js';


const scores: EmotionScores = {
  기쁨: 1,
  슬픔: 7,
  분노: 2,
  불안: 6,
  놀람: 3,
  혐오: 2,
  중립: 5,
};

function diary(overrides: Partial<DiaryEntry> = {}): DiaryEntry {
  return {
    diaryId: 'diary-1',
    userId: 'user-1',
    sessionId: 'sess-1',
    sessionDate: '2026-05-28',
    title: '하루의 끝',
    tags: ['회고', '쉼'],
    bodyType: 'full',
    body: '나는 오늘 하루를 돌아보았다.',
    emotionScores: scores,
    peakRiskLevel: '저위험',
    createdAt: new Date('2026-05-28T09:31:00.000Z'),
    ...overrides,
  };
}

function meta(overrides: Partial<ArtifactMeta> = {}): ArtifactMeta {
  return {
    artifactId: 'art-1',
    artifactType: 'emotion_diary',
    userId: 'user-1',
    sessionId: 'sess-1',
    accessPolicy: { owner: 'user', share: [] },
    payloadRef: 'diary-1',
    createdAt: new Date('2026-05-28T09:31:00.000Z'),
    ...overrides,
  };
}

describe('PgDiaryRepository', () => {
  it('inserts a diary row with all 7 emotion columns mapped', async () => {
    const fake = createFakePool();
    const repo = new PgDiaryRepository(fake.pool);
    await repo.insert(diary());
    expect(fake.recorded).toHaveLength(1);
    const call = fake.recorded[0];
    expect(call?.text).toContain('INSERT INTO diary_entries');
    expect(call?.params.slice(8, 15)).toEqual([1, 7, 2, 6, 3, 2, 5]);
  });

  it('casts session_date to text on select', async () => {
    const fake = createFakePool();
    const repo = new PgDiaryRepository(fake.pool);
    await repo.findById('user-1', 'diary-1');
    expect(fake.recorded[0]?.text).toContain('session_date::text');
  });
});

describe('PgArtifactRepository', () => {
  it('inserts artifact meta with payload_ref referencing the diary id', async () => {
    const fake = createFakePool();
    const repo = new PgArtifactRepository(fake.pool);
    await repo.insert(meta());
    const call = fake.recorded[0];
    expect(call?.text).toContain('INSERT INTO artifacts');
    expect(call?.params[6]).toBe('diary-1');
  });
});

describe('dual write within a single transaction', () => {
  it('runs both inserts on the same transaction client', async () => {
    const fake = createFakePool();
    const runner = new PgTransactionRunner(fake.pool);
    const diaryRepo = new PgDiaryRepository(fake.pool);
    const artifactRepo = new PgArtifactRepository(fake.pool);

    await runner.run(async (tx) => {
      await diaryRepo.insert(diary(), tx);
      await artifactRepo.insert(meta(), tx);
    });

    expect(fake.clients).toHaveLength(1);
    const clientQueries = fake.clients[0]?.recorded.map((q) => q.text) ?? [];
    expect(clientQueries[0]).toBe('BEGIN');
    expect(clientQueries.some((t) => t.includes('INSERT INTO diary_entries'))).toBe(true);
    expect(clientQueries.some((t) => t.includes('INSERT INTO artifacts'))).toBe(true);
    expect(clientQueries[clientQueries.length - 1]).toBe('COMMIT');
    expect(fake.recorded).toHaveLength(0);
  });
});

describe('InMemoryDiaryRepository', () => {
  it('orders by session_date DESC and isolates by user', async () => {
    const repo = new InMemoryDiaryRepository();
    await repo.insert(diary({ diaryId: 'd1', sessionDate: '2026-05-26' }));
    await repo.insert(diary({ diaryId: 'd2', sessionDate: '2026-05-28' }));
    await repo.insert(diary({ diaryId: 'd3', sessionDate: '2026-05-27' }));
    await repo.insert(diary({ diaryId: 'other', userId: 'user-2', sessionDate: '2026-05-29' }));

    const list = await repo.listByUser('user-1', { limit: 10, offset: 0 });
    expect(list.map((d) => d.diaryId)).toEqual(['d2', 'd3', 'd1']);

    const recent = await repo.findRecentByUser('user-1', 2);
    expect(recent.map((d) => d.diaryId)).toEqual(['d2', 'd3']);

    expect(await repo.findById('user-1', 'other')).toBeUndefined();
  });

  it('paginates with limit/offset', async () => {
    const repo = new InMemoryDiaryRepository();
    for (let i = 0; i < 5; i += 1) {
      await repo.insert(
        diary({ diaryId: `d${i}`, sessionDate: `2026-05-2${i}` }),
      );
    }
    const page2 = await repo.listByUser('user-1', { limit: 2, offset: 2 });
    expect(page2).toHaveLength(2);
  });
});

describe('InMemoryArtifactRepository', () => {
  it('stores and retrieves artifact meta', async () => {
    const repo = new InMemoryArtifactRepository();
    await repo.insert(meta());
    expect((await repo.findById('art-1'))?.payloadRef).toBe('diary-1');
    expect(repo.list()).toHaveLength(1);
  });
});
