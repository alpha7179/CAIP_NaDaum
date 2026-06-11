// 산출물 생성·영속화 파이프라인 어댑터

import type { DiaryEntry } from '@nadaum/shared';

import type {
  ConsentSnapshot,
  ProducedArtifact,
} from '../../domain/artifact/ArtifactProducer.js';
import type { ArtifactProducerRegistry } from '../../domain/artifact/ArtifactProducerRegistry.js';
import type { SessionResult } from '../../domain/artifact/SessionResult.js';
import type { TransactionContext, TransactionRunner } from '../../domain/auth/ports.js';
import type { ArtifactMeta, ArtifactRepository, DiaryRepository } from '../../domain/diary/ports.js';
import type { DiaryEmbedder } from '../../domain/diary/recall/ports.js';
import type { ArtifactPipeline } from '../../domain/session/SessionOrchestrator.js';
import type { DiaryEmbeddingPersistence } from '../persistence/DiaryRepository.js';

const EMOTION_DIARY_TYPE = 'emotion_diary';

// ArtifactPersistencePipeline 생성자 옵션
export interface ArtifactPersistencePipelineOptions {
  readonly registry: ArtifactProducerRegistry;
  readonly diaries: DiaryRepository;
  readonly artifacts: ArtifactRepository;
  readonly transactions?: TransactionRunner;
  readonly embedder?: DiaryEmbedder;
  readonly embeddingPersistence?: DiaryEmbeddingPersistence;
}

export class ArtifactPersistencePipeline implements ArtifactPipeline {
  private readonly registry: ArtifactProducerRegistry;
  private readonly diaries: DiaryRepository;
  private readonly artifactRepo: ArtifactRepository;
  private readonly transactions: TransactionRunner | undefined;
  private readonly embedder: DiaryEmbedder | undefined;
  private readonly embeddingPersistence: DiaryEmbeddingPersistence | undefined;

  public constructor(options: ArtifactPersistencePipelineOptions) {
    this.registry = options.registry;
    this.diaries = options.diaries;
    this.artifactRepo = options.artifacts;
    this.transactions = options.transactions;
    this.embedder = options.embedder;
    this.embeddingPersistence = options.embeddingPersistence;
  }

  public async generateAndPersist(
    session: SessionResult,
    consents: ConsentSnapshot,
  ): Promise<ProducedArtifact[]> {
    const produced = await this.registry.produceAll(session, consents);

    const persistedDiaries: DiaryEntry[] = [];

    const persist = async (tx?: TransactionContext): Promise<void> => {
      for (const artifact of produced) {
        if (artifact.artifactType !== EMOTION_DIARY_TYPE) {
          continue;
        }
        const diary = artifact.payload as DiaryEntry;
        await this.diaries.insert(diary, tx);
        const meta: ArtifactMeta = {
          artifactId: artifact.artifactId,
          artifactType: artifact.artifactType,
          userId: artifact.ownerUserId,
          sessionId: diary.sessionId,
          ...(artifact.recipients !== undefined ? { recipients: artifact.recipients } : {}),
          accessPolicy: artifact.accessPolicy,
          payloadRef: diary.diaryId,
          createdAt: artifact.createdAt,
        };
        await this.artifactRepo.insert(meta, tx);
        persistedDiaries.push(diary);
      }
    };

    if (this.transactions !== undefined) {
      await this.transactions.run(async (tx) => persist(tx));
    } else {
      await persist();
    }

    if (this.embedder !== undefined && this.embeddingPersistence !== undefined) {
      for (const diary of persistedDiaries) {
        try {
          const vector = await this.embedder.embed(diary.body);
          if (vector.length > 0) {
            await this.embeddingPersistence.setEmbedding(diary.userId, diary.diaryId, vector);
          }
        } catch {
          /* noop */
        }
      }
    }

    return produced;
  }
}
