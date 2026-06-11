// 백엔드 전체 종단 통합 검증 (페이크 외부 AI 어댑터 기반).
import { describe, expect, it } from 'vitest';

import { PassthroughHook } from '../adapters/ai-gateway/PassthroughHook.js';
import { FAKE_EXTERNAL_ADAPTERS } from '../adapters/ai-gateway/__fakes__/fakeExternalAdapters.js';
import { createBoundGateway } from '../adapters/ai-gateway/boundGateway.js';
import { ArtifactPersistencePipeline } from '../adapters/artifact/ArtifactPersistencePipeline.js';
import {
  DiaryProducer,
  type DiaryAIGateway,
} from '../adapters/artifact/DiaryProducer.js';
import {
  Gpt4oDialogueAdapter,
  type DialogueAIGateway,
} from '../adapters/dialogue/Gpt4oDialogueAdapter.js';
import { TextChannel, type EmotionAIGateway } from '../adapters/emotion/TextChannel.js';
import { InMemoryArtifactRepository } from '../adapters/persistence/ArtifactRepository.js';
import { InMemoryDiaryRepository as DiaryRepo } from '../adapters/persistence/DiaryRepository.js';
import { InMemorySafetyAuditLogger } from '../adapters/persistence/SafetyAuditLogger.js';
import { InMemorySessionRepository } from '../adapters/persistence/SessionRepository.js';
import { ArtifactProducerRegistry } from '../domain/artifact/ArtifactProducerRegistry.js';
import { DialogueEngineImpl } from '../domain/dialogue/DialogueEngine.js';
import { createMvpEmotionAnalyzer } from '../domain/emotion/EmotionAnalyzer.js';
import { NotificationChannelRegistry } from '../domain/notification/NotificationChannelRegistry.js';
import { DiaryQueryService } from '../domain/query/DiaryQueryService.js';
import { createMvpRiskEvaluator } from '../domain/risk/RiskEvaluator.js';
import { SafetyProtocol } from '../domain/safety/SafetyProtocol.js';
import { AIGatewayImpl } from '../domain/ai-gateway/AIGateway.js';
import { SessionOrchestrator } from '../domain/session/SessionOrchestrator.js';

async function buildBackend() {
  const gateway = new AIGatewayImpl(new PassthroughHook());
  gateway.registerAdapter('gpt4o_emotion', FAKE_EXTERNAL_ADAPTERS.gpt4o_emotion);
  gateway.registerAdapter('gpt4o_dialogue', FAKE_EXTERNAL_ADAPTERS.gpt4o_dialogue);
  gateway.registerAdapter('gpt4o_diary', FAKE_EXTERNAL_ADAPTERS.gpt4o_diary);

  const bound = createBoundGateway(gateway, { userId: 'u1' });

  const textChannel = new TextChannel({
    gateway: bound as unknown as EmotionAIGateway,
    retryDelayMs: 0,
  });
  const emotion = createMvpEmotionAnalyzer(textChannel);

  const dialogueGen = new Gpt4oDialogueAdapter({
    gateway: bound as unknown as DialogueAIGateway,
    retryDelayMs: 0,
  });
  const dialogue = new DialogueEngineImpl(dialogueGen);

  const { evaluator, keywordSignal } = createMvpRiskEvaluator({
    isHighRisk: () => false,
    loadKeywords: () => [],
  });
  await keywordSignal.refresh();

  const audit = new InMemorySafetyAuditLogger();
  const safety = new SafetyProtocol({
    auditLogger: audit,
    notificationRegistry: new NotificationChannelRegistry(),
    random: () => 0,
  });

  const sessions = new InMemorySessionRepository();
  const diaryRepo = new DiaryRepo();
  const artifactRepo = new InMemoryArtifactRepository();

  let diaryCounter = 0;
  const registry = new ArtifactProducerRegistry({
    idFactory: () => `artifact-${(diaryCounter += 1)}`,
  });
  let diaryIdCounter = 0;
  registry.register(
    new DiaryProducer({
      gateway: bound as unknown as DiaryAIGateway,
      idFactory: () => `diary-${(diaryIdCounter += 1)}`,
      retryDelayMs: 0,
    }),
  );
  const pipeline = new ArtifactPersistencePipeline({
    registry,
    diaries: diaryRepo,
    artifacts: artifactRepo,
  });

  let sessionCounter = 0;
  const orchestrator = new SessionOrchestrator({
    emotion,
    dialogue,
    risk: evaluator,
    safety,
    sessions,
    artifacts: pipeline,
    consents: {
      getConsents: (userId: string) => ({ userId, granted: { emotion_diary: true } }),
    },
    idFactory: () => `sess-${(sessionCounter += 1)}`,
  });

  const diaryQuery = new DiaryQueryService(diaryRepo);

  return { gateway, orchestrator, diaryQuery, audit, artifactRepo };
}

describe('Checkpoint 14: backend end-to-end', () => {
  it('runs session → utterances → end → diary → list/trend through the single AI gateway', async () => {
    const { gateway, orchestrator, diaryQuery, audit, artifactRepo } = await buildBackend();

    const ctx = await orchestrator.startSession('u1');
    expect(ctx.stage).toBe('상황파악');

    for (const text of ['오늘 좀 우울했어', '계속 무기력해', '잠도 잘 안 와']) {
      const r = await orchestrator.handleUtterance(ctx.sessionId, { text });
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.aiResponse.length).toBeGreaterThan(0);
      expect(r.riskLevel).toBe('저위험');
    }

    const ended = await orchestrator.endSession(ctx.sessionId, 'user');
    expect(ended.reason).toBe('user');
    expect(ended.finalRiskLevel).toBe('저위험');
    expect(ended.artifacts).toHaveLength(1);

    const page = await diaryQuery.list('u1', 0);
    expect(page.items).toHaveLength(1);
    expect(page.items[0]?.bodyType).toBe('full');
    expect(page.items[0]?.body.length).toBeGreaterThanOrEqual(200);

    const diaryId = page.items[0]!.diaryId;
    expect((await diaryQuery.getById('u1', diaryId))?.diaryId).toBe(diaryId);

    const trend = await diaryQuery.getRecentTrend('u1', 7);
    expect(trend.points).toHaveLength(1);

    const metas = artifactRepo.list();
    expect(metas).toHaveLength(1);
    expect(metas[0]?.payloadRef).toBe(diaryId);

    expect(audit.list().some((r) => r.eventType === 'low_intervention')).toBe(true);

    const stats = gateway.getCallStats();
    expect(stats.callCount).toBeGreaterThan(0);
    expect(stats.callCount).toBe(stats.hookApplyCount);
    expect(stats.callCount).toBe(stats.externalInvokeCount);
  });

  it('high-risk keyword forces finalize and logs high intervention end-to-end', async () => {
    const { gateway: _g, orchestrator, audit } = await buildBackendWithKeyword('자살');
    const ctx = await orchestrator.startSession('u1');
    const r = await orchestrator.handleUtterance(ctx.sessionId, { text: '자살하고 싶어' });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.riskLevel).toBe('고위험');
      expect(r.forceFinalize).toBe(true);
    }
    await orchestrator.endSession(ctx.sessionId, 'high_risk');
    expect(audit.list().some((x) => x.eventType === 'high_intervention')).toBe(true);
  });
});

async function buildBackendWithKeyword(keyword: string) {
  const gateway = new AIGatewayImpl(new PassthroughHook());
  gateway.registerAdapter('gpt4o_emotion', FAKE_EXTERNAL_ADAPTERS.gpt4o_emotion);
  gateway.registerAdapter('gpt4o_dialogue', FAKE_EXTERNAL_ADAPTERS.gpt4o_dialogue);
  gateway.registerAdapter('gpt4o_diary', FAKE_EXTERNAL_ADAPTERS.gpt4o_diary);
  const bound = createBoundGateway(gateway, { userId: 'u1' });

  const emotion = createMvpEmotionAnalyzer(
    new TextChannel({ gateway: bound as unknown as EmotionAIGateway, retryDelayMs: 0 }),
  );
  const dialogue = new DialogueEngineImpl(
    new Gpt4oDialogueAdapter({ gateway: bound as unknown as DialogueAIGateway, retryDelayMs: 0 }),
  );

  const { evaluator, keywordSignal } = createMvpRiskEvaluator({
    isHighRisk: (t: string) => t.includes(keyword),
    loadKeywords: () => [keyword],
  });
  await keywordSignal.refresh();

  const audit = new InMemorySafetyAuditLogger();
  const safety = new SafetyProtocol({
    auditLogger: audit,
    notificationRegistry: new NotificationChannelRegistry(),
    random: () => 0,
  });
  const sessions = new InMemorySessionRepository();
  const diaryRepo = new DiaryRepo();
  const artifactRepo = new InMemoryArtifactRepository();
  const registry = new ArtifactProducerRegistry({ idFactory: () => 'a1' });
  registry.register(
    new DiaryProducer({
      gateway: bound as unknown as DiaryAIGateway,
      idFactory: () => 'd1',
      retryDelayMs: 0,
    }),
  );
  const pipeline = new ArtifactPersistencePipeline({ registry, diaries: diaryRepo, artifacts: artifactRepo });

  const orchestrator = new SessionOrchestrator({
    emotion,
    dialogue,
    risk: evaluator,
    safety,
    sessions,
    artifacts: pipeline,
    consents: { getConsents: (userId: string) => ({ userId, granted: { emotion_diary: true } }) },
    idFactory: () => 'sess-x',
  });

  return { gateway, orchestrator, audit };
}
