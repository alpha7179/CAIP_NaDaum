// ArtifactProducerRegistry 단위 테스트
import { describe, expect, it, vi } from 'vitest';

import type {
  ConsentSnapshot,
  ProducedArtifact,
} from './ArtifactProducer.js';
import type { ArtifactProducer } from './ArtifactProducer.js';
import { ArtifactProducerRegistry } from './ArtifactProducerRegistry.js';
import type { SessionResult } from './SessionResult.js';

function makeSessionResult(
  overrides: Partial<SessionResult> = {},
): SessionResult {
  return {
    sessionId: 'sess-1',
    userId: 'user-1',
    exchanges: [],
    cumulativeEmotion: {
      combinedScores: {
        기쁨: 5,
        슬픔: 5,
        분노: 5,
        불안: 5,
        놀람: 5,
        혐오: 5,
        중립: 5,
      },
      perChannel: [],
      missingChannels: [],
      policy: 'text_only',
    },
    distortions: [],
    riskTrajectory: [],
    endedAt: new Date('2025-01-01T00:10:00Z'),
    ...overrides,
  };
}

function makeConsents(
  granted: Record<string, boolean> = {},
  userId = 'user-1',
): ConsentSnapshot {
  return { userId, granted };
}

interface FakeProducerOptions {
  artifactType: string;
  requiresConsent?: string;
  payload?: unknown;
}

function makeFakeProducer(opts: FakeProducerOptions): {
  producer: ArtifactProducer<unknown>;
  produce: ReturnType<typeof vi.fn>;
} {
  const produce = vi.fn(async () => opts.payload ?? { type: opts.artifactType });
  const producer: ArtifactProducer<unknown> = {
    artifactType: opts.artifactType,
    requiresConsent: opts.requiresConsent,
    produce,
  };
  return { producer, produce };
}

function makeIdFactory(prefix = 'art'): () => string {
  let i = 0;
  return () => `${prefix}-${++i}`;
}

describe('ArtifactProducerRegistry', () => {
  describe('register()', () => {
    it('rejects duplicate artifactType registration', () => {
      const registry = new ArtifactProducerRegistry({
        idFactory: makeIdFactory(),
      });
      const { producer: a } = makeFakeProducer({
        artifactType: 'emotion_diary',
      });
      const { producer: b } = makeFakeProducer({
        artifactType: 'emotion_diary',
      });

      registry.register(a);
      expect(() => registry.register(b)).toThrow(/already registered/i);
    });

    it('allows registering different artifactTypes', () => {
      const registry = new ArtifactProducerRegistry({
        idFactory: makeIdFactory(),
      });
      const { producer: a } = makeFakeProducer({
        artifactType: 'emotion_diary',
      });
      const { producer: b } = makeFakeProducer({
        artifactType: 'counselor_report',
      });
      expect(() => {
        registry.register(a);
        registry.register(b);
      }).not.toThrow();
    });
  });

  describe('produceAll() consent gate', () => {
    it('skips producer when requiresConsent key is missing in granted map', async () => {
      const registry = new ArtifactProducerRegistry({
        idFactory: makeIdFactory(),
      });
      const { producer, produce } = makeFakeProducer({
        artifactType: 'counselor_report',
        requiresConsent: 'counselor_report',
      });
      registry.register(producer);

      const results = await registry.produceAll(
        makeSessionResult(),
        makeConsents({}),
      );

      expect(produce).not.toHaveBeenCalled();
      expect(results).toEqual([]);
    });

    it('skips producer when requiresConsent key is explicitly false', async () => {
      const registry = new ArtifactProducerRegistry({
        idFactory: makeIdFactory(),
      });
      const { producer, produce } = makeFakeProducer({
        artifactType: 'counselor_report',
        requiresConsent: 'counselor_report',
      });
      registry.register(producer);

      const results = await registry.produceAll(
        makeSessionResult(),
        makeConsents({ counselor_report: false }),
      );

      expect(produce).not.toHaveBeenCalled();
      expect(results).toEqual([]);
    });

    it('runs producer when requiresConsent key is true', async () => {
      const registry = new ArtifactProducerRegistry({
        idFactory: makeIdFactory(),
      });
      const { producer, produce } = makeFakeProducer({
        artifactType: 'counselor_report',
        requiresConsent: 'counselor_report',
        payload: { reportId: 'r-1' },
      });
      registry.register(producer);

      const results = await registry.produceAll(
        makeSessionResult(),
        makeConsents({ counselor_report: true }),
      );

      expect(produce).toHaveBeenCalledTimes(1);
      expect(results).toHaveLength(1);
      expect(results[0]?.artifactType).toBe('counselor_report');
      expect(results[0]?.payload).toEqual({ reportId: 'r-1' });
    });

    it('runs producer without consent check when requiresConsent is undefined', async () => {
      const registry = new ArtifactProducerRegistry({
        idFactory: makeIdFactory(),
      });
      const { producer, produce } = makeFakeProducer({
        artifactType: 'emotion_diary',
      });
      registry.register(producer);

      const results = await registry.produceAll(
        makeSessionResult(),
        makeConsents({}),
      );

      expect(produce).toHaveBeenCalledTimes(1);
      expect(results).toHaveLength(1);
      expect(results[0]?.artifactType).toBe('emotion_diary');
    });

    it('treats truthy non-true values as not granted (strict === true)', async () => {
      const registry = new ArtifactProducerRegistry({
        idFactory: makeIdFactory(),
      });
      const { producer, produce } = makeFakeProducer({
        artifactType: 'counselor_report',
        requiresConsent: 'counselor_report',
      });
      registry.register(producer);

      const results = await registry.produceAll(
        makeSessionResult(),
        makeConsents({ counselor_report: 1 }),
      );

      expect(produce).not.toHaveBeenCalled();
      expect(results).toEqual([]);
    });
  });

  describe('produceAll() ordering and metadata', () => {
    it('preserves registration order in results', async () => {
      const registry = new ArtifactProducerRegistry({
        idFactory: makeIdFactory('id'),
      });
      const { producer: p1 } = makeFakeProducer({
        artifactType: 'emotion_diary',
      });
      const { producer: p2 } = makeFakeProducer({
        artifactType: 'counselor_report',
        requiresConsent: 'counselor_report',
      });
      const { producer: p3 } = makeFakeProducer({
        artifactType: 'self_assessment',
        requiresConsent: 'self_assessment',
      });

      registry.register(p1);
      registry.register(p2);
      registry.register(p3);

      const results = await registry.produceAll(
        makeSessionResult(),
        makeConsents({ counselor_report: true, self_assessment: true }),
      );

      expect(results.map((r) => r.artifactType)).toEqual([
        'emotion_diary',
        'counselor_report',
        'self_assessment',
      ]);
    });

    it('keeps registration order even when middle producer is gated out', async () => {
      const registry = new ArtifactProducerRegistry({
        idFactory: makeIdFactory(),
      });
      const { producer: p1 } = makeFakeProducer({
        artifactType: 'emotion_diary',
      });
      const { producer: p2 } = makeFakeProducer({
        artifactType: 'counselor_report',
        requiresConsent: 'counselor_report',
      });
      const { producer: p3 } = makeFakeProducer({
        artifactType: 'self_assessment',
      });
      registry.register(p1);
      registry.register(p2);
      registry.register(p3);

      const results = await registry.produceAll(
        makeSessionResult(),
        makeConsents({ counselor_report: false }),
      );

      expect(results.map((r) => r.artifactType)).toEqual([
        'emotion_diary',
        'self_assessment',
      ]);
    });

    it('fills metadata fields with defaults', async () => {
      const fixedNow = new Date('2025-02-03T04:05:06Z');
      const registry = new ArtifactProducerRegistry({
        idFactory: makeIdFactory('art'),
        clock: () => fixedNow,
      });
      const { producer } = makeFakeProducer({
        artifactType: 'emotion_diary',
        payload: { diaryId: 'd-1', body: 'sample' },
      });
      registry.register(producer);

      const session = makeSessionResult({ userId: 'user-42' });
      const results = await registry.produceAll(session, makeConsents({}));

      expect(results).toHaveLength(1);
      const a = results[0] as ProducedArtifact;
      expect(a.artifactId).toBe('art-1');
      expect(a.ownerUserId).toBe('user-42');
      expect(a.accessPolicy).toEqual({ owner: 'user', share: [] });
      expect(a.createdAt).toEqual(fixedNow);
      expect(a.payload).toEqual({ diaryId: 'd-1', body: 'sample' });
    });

    it('returns empty array when no producers are registered', async () => {
      const registry = new ArtifactProducerRegistry({
        idFactory: makeIdFactory(),
      });
      const results = await registry.produceAll(
        makeSessionResult(),
        makeConsents({}),
      );
      expect(results).toEqual([]);
    });

    it('passes the same SessionResult instance to each producer', async () => {
      const registry = new ArtifactProducerRegistry({
        idFactory: makeIdFactory(),
      });
      const { producer: p1, produce: produce1 } = makeFakeProducer({
        artifactType: 'emotion_diary',
      });
      const { producer: p2, produce: produce2 } = makeFakeProducer({
        artifactType: 'self_assessment',
      });
      registry.register(p1);
      registry.register(p2);

      const session = makeSessionResult();
      await registry.produceAll(session, makeConsents({}));

      expect(produce1).toHaveBeenCalledWith(session);
      expect(produce2).toHaveBeenCalledWith(session);
    });
  });
});
