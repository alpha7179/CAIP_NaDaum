// SessionOrchestrator 통합 단위 테스트
import type { CalibratedEmotion, EmotionScores } from '@nadaum/shared';
import { describe, expect, it } from 'vitest';


import { InMemorySafetyAuditLogger } from '../../adapters/persistence/SafetyAuditLogger.js';
import { InMemorySessionRepository } from '../../adapters/persistence/SessionRepository.js';
import { DialogueEngineImpl } from '../dialogue/DialogueEngine.js';
import type { DialogueGenerator } from '../dialogue/DialogueEngine.js';
import { EmotionAnalyzer } from '../emotion/EmotionAnalyzer.js';
import type { EmotionChannel } from '../emotion/EmotionChannel.js';
import { NotificationChannelRegistry } from '../notification/NotificationChannelRegistry.js';
import { EmotionScoreSignal } from '../risk/EmotionScoreSignal.js';
import { KeywordSignal } from '../risk/KeywordSignal.js';
import { RiskEvaluator } from '../risk/RiskEvaluator.js';
import { SafetyProtocol } from '../safety/SafetyProtocol.js';

import { SessionOrchestrator } from './SessionOrchestrator.js';

function calibratedFrom(scores: EmotionScores): CalibratedEmotion {
  return {
    combinedScores: scores,
    perChannel: [
      { channelId: 'text', scores, distortions: [], confidence: 1, meta: { latencyMs: 0, modelVersion: 'fake' } },
    ],
    missingChannels: [],
    policy: 'text_only',
  };
}

function fakeChannel(scores: EmotionScores): EmotionChannel {
  return {
    channelId: 'text',
    async isAvailable() {
      return true;
    },
    async analyze() {
      return { channelId: 'text', scores, distortions: [], confidence: 1, meta: { latencyMs: 0, modelVersion: 'fake' } };
    },
  };
}

const fakeDialogueGenerator: DialogueGenerator = {
  async generate() {
    return { aiResponse: '그랬군요. 그 마음을 조금 더 들려주실 수 있을까요?' };
  },
};

const lowScores: EmotionScores = { 기쁨: 6, 슬픔: 4, 분노: 2, 불안: 3, 놀람: 2, 혐오: 2, 중립: 5 };
const highAnxiety: EmotionScores = { 기쁨: 1, 슬픔: 7, 분노: 3, 불안: 10, 놀람: 4, 혐오: 3, 중립: 2 };

function makeOrchestrator(opts: {
  scores: EmotionScores;
  keywords?: string[];
  emotionThrows?: boolean;
}): {
  orchestrator: SessionOrchestrator;
  audit: InMemorySafetyAuditLogger;
  sessions: InMemorySessionRepository;
} {
  const audit = new InMemorySafetyAuditLogger();
  const sessions = new InMemorySessionRepository();
  const safety = new SafetyProtocol({
    auditLogger: audit,
    notificationRegistry: new NotificationChannelRegistry(),
    random: () => 0,
  });

  const emotion = new EmotionAnalyzer({ policy: 'text_only' });
  if (opts.emotionThrows) {
    emotion.registerChannel({
      channelId: 'text',
      async isAvailable() {
        return true;
      },
      async analyze() {
        throw new Error('emotion service down');
      },
    });
  } else {
    emotion.registerChannel(fakeChannel(opts.scores));
  }

  const keywordSet = new Set(opts.keywords ?? []);
  const keywordSignal = new KeywordSignal({
    isHighRisk: (text: string) => [...keywordSet].some((k) => text.includes(k)),
    loadKeywords: () => [...keywordSet],
  });
  keywordSignal.setKeywordsForTesting([...keywordSet]);
  const risk = new RiskEvaluator();
  risk.registerSignal(keywordSignal);
  risk.registerSignal(new EmotionScoreSignal());

  const dialogue = new DialogueEngineImpl(fakeDialogueGenerator);

  const orchestrator = new SessionOrchestrator({
    emotion,
    dialogue,
    risk,
    safety,
    sessions,
    idFactory: (() => {
      let n = 0;
      return () => `sess-${(n += 1)}`;
    })(),
    clock: () => new Date('2026-05-28T10:00:00.000Z'),
  });

  return { orchestrator, audit, sessions };
}

describe('SessionOrchestrator.startSession', () => {
  it('creates and persists an empty session at stage 상황파악', async () => {
    const { orchestrator, sessions } = makeOrchestrator({ scores: lowScores });
    const ctx = await orchestrator.startSession('user-1');
    expect(ctx.stage).toBe('상황파악');
    expect(await sessions.getSession(ctx.sessionId)).toBeDefined();
  });
});

describe('SessionOrchestrator.handleUtterance', () => {
  it('processes text input through emotion + dialogue + risk and persists', async () => {
    const { orchestrator, audit } = makeOrchestrator({ scores: lowScores });
    const ctx = await orchestrator.startSession('user-1');
    const result = await orchestrator.handleUtterance(ctx.sessionId, { text: '오늘 좀 우울했어' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.transcript).toBe('오늘 좀 우울했어');
    expect(result.aiResponse.length).toBeGreaterThan(0);
    expect(result.riskLevel).toBe('저위험');
    expect(result.forceFinalize).toBe(false);
    expect(audit.list().filter((r) => r.eventType === 'risk_evaluated')).toHaveLength(1);
  });

  it('flags forceFinalize on high-risk keyword', async () => {
    const { orchestrator } = makeOrchestrator({ scores: lowScores, keywords: ['자살'] });
    const ctx = await orchestrator.startSession('user-1');
    const result = await orchestrator.handleUtterance(ctx.sessionId, {
      text: '자살하고 싶다는 생각이 들어',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.riskLevel).toBe('고위험');
    expect(result.forceFinalize).toBe(true);
  });

  it('falls back to keyword-only risk when emotion analysis fails', async () => {
    const { orchestrator } = makeOrchestrator({
      scores: lowScores,
      emotionThrows: true,
      keywords: ['자해'],
    });
    const ctx = await orchestrator.startSession('user-1');
    const result = await orchestrator.handleUtterance(ctx.sessionId, {
      text: '자해를 했어',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.riskLevel).toBe('고위험');
  });
});

describe('SessionOrchestrator.handleSilenceTimeout', () => {
  it('notifies on first timeout and auto-ends on second', async () => {
    const { orchestrator } = makeOrchestrator({ scores: lowScores });
    const ctx = await orchestrator.startSession('user-1');
    const first = await orchestrator.handleSilenceTimeout(ctx.sessionId, 'first');
    expect(first.action).toBe('notify');
    const second = await orchestrator.handleSilenceTimeout(ctx.sessionId, 'second');
    expect(second.action).toBe('ended');
    if (second.action !== 'ended') return;
    expect(second.result.reason).toBe('silence');
  });
});

describe('SessionOrchestrator.endSession', () => {
  it('runs low-risk intervention and deletes the session', async () => {
    const { orchestrator, audit, sessions } = makeOrchestrator({ scores: lowScores });
    const ctx = await orchestrator.startSession('user-1');
    await orchestrator.handleUtterance(ctx.sessionId, { text: '오늘은 평온했어' });
    const result = await orchestrator.endSession(ctx.sessionId, 'user');
    expect(result.finalRiskLevel).toBe('저위험');
    expect(audit.list().some((r) => r.eventType === 'low_intervention')).toBe(true);
    expect(await sessions.getSession(ctx.sessionId)).toBeUndefined();
  });

  it('logs abnormal end + high intervention for high-risk silence end', async () => {
    const { orchestrator, audit } = makeOrchestrator({ scores: highAnxiety, keywords: ['자살'] });
    const ctx = await orchestrator.startSession('user-1');
    await orchestrator.handleUtterance(ctx.sessionId, { text: '자살 생각이 나' });
    const result = await orchestrator.endSession(ctx.sessionId, 'high_risk');
    expect(result.finalRiskLevel).toBe('고위험');
    expect(audit.list().some((r) => r.eventType === 'high_intervention')).toBe(true);
  });
});
