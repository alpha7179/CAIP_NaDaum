// SessionOrchestrator — 세션 라이프사이클 오케스트레이션

import type {
  CalibratedEmotion,
  ConversationStage,
  EmotionAnalysisResult,
  EmotionScores,
  RiskLevel,
  RiskTrajectoryPoint,
  SessionContext,
} from '@nadaum/shared';

import type {
  ConsentSnapshot,
  ProducedArtifact,
} from '../artifact/ArtifactProducer.js';
import { fromSessionContext } from '../artifact/SessionResult.js';
import type { DialogueEngine } from '../dialogue/DialogueEngine.js';
import type { DiaryRecallPort } from '../diary/recall/DiaryRecallService.js';
import type { RecalledDiary } from '../diary/recall/types.js';
import type { EmotionAnalyzer } from '../emotion/EmotionAnalyzer.js';
import { appendUtteranceResult } from '../emotion/EmotionAnalyzer.js';
import type { RiskEvaluator } from '../risk/RiskEvaluator.js';
import {
  type RiskModelAssessor,
  SUICIDALITY_MODEL_OUTPUT_KEY,
} from '../risk/SuicidalityModelSignal.js';
import type { SafetyProtocol } from '../safety/SafetyProtocol.js';

import { addExchange, createInitialSessionContext } from './SessionContext.js';
import type { SessionRepository } from './SessionRepository.js';

export interface ArtifactPipeline {
  generateAndPersist(
    session: ReturnType<typeof fromSessionContext>,
    consents: ConsentSnapshot,
  ): Promise<ProducedArtifact[]>;
}

export interface ConsentProvider {
  getConsents(userId: string): Promise<ConsentSnapshot> | ConsentSnapshot;
}

export interface SessionOrchestratorOptions {
  readonly emotion: EmotionAnalyzer;
  readonly dialogue: DialogueEngine;
  readonly risk: RiskEvaluator;
  readonly riskModel?: RiskModelAssessor;
  readonly safety: SafetyProtocol;
  readonly sessions: SessionRepository;
  readonly recall?: DiaryRecallPort;
  readonly artifacts?: ArtifactPipeline;
  readonly consents?: ConsentProvider;
  readonly idFactory: () => string;
  readonly clock?: () => Date;
}

export type EndReason = 'user' | 'silence' | 'high_risk' | 'error';

export type UtteranceInput = { readonly text: string };

export type HandleUtteranceResult =
  | {
      readonly ok: false;
      readonly reason: 'session_not_found';
    }
  | {
      readonly ok: true;
      readonly transcript: string;
      readonly aiResponse: string;
      readonly emotion: CalibratedEmotion;
      readonly riskLevel: RiskLevel;
      readonly perSignal: ReadonlyArray<{ signalId: string; level: RiskLevel }>;
      readonly stage: ConversationStage;
      readonly forceFinalize: boolean;
      readonly dialogueDegraded: boolean;
    };

export type SilenceAction =
  | { readonly action: 'notify' }
  | { readonly action: 'ended'; readonly result: EndSessionResult };

export interface EndSessionResult {
  readonly reason: EndReason;
  readonly sessionId: string;
  readonly finalRiskLevel: RiskLevel;
  readonly artifacts: ProducedArtifact[];
}

const NEUTRAL_SCORES: EmotionScores = {
  기쁨: 5,
  슬픔: 5,
  분노: 5,
  불안: 5,
  놀람: 5,
  혐오: 5,
  중립: 5,
};

const DIALOGUE_FALLBACK_RESPONSE =
  '지금 마음을 잘 들었어요. 잠시 호흡을 고르고, 다시 한 번 천천히 이야기해 주실 수 있을까요?';

export class SessionOrchestrator {
  private readonly emotion: EmotionAnalyzer;
  private readonly dialogue: DialogueEngine;
  private readonly risk: RiskEvaluator;
  private readonly riskModel: RiskModelAssessor | undefined;
  private readonly safety: SafetyProtocol;
  private readonly sessions: SessionRepository;
  private readonly recall: DiaryRecallPort | undefined;
  private readonly artifacts: ArtifactPipeline | undefined;
  private readonly consentProvider: ConsentProvider | undefined;
  private readonly idFactory: () => string;
  private readonly clock: () => Date;

  public constructor(options: SessionOrchestratorOptions) {
    this.emotion = options.emotion;
    this.dialogue = options.dialogue;
    this.risk = options.risk;
    this.riskModel = options.riskModel;
    this.safety = options.safety;
    this.sessions = options.sessions;
    this.recall = options.recall;
    this.artifacts = options.artifacts;
    this.consentProvider = options.consents;
    this.idFactory = options.idFactory;
    this.clock = options.clock ?? ((): Date => new Date());
  }

  public async startSession(userId: string): Promise<SessionContext> {
    const sessionId = this.idFactory();
    const context = createInitialSessionContext({
      sessionId,
      userId,
      startedAt: this.clock(),
    });
    await this.sessions.saveSession(context);
    return context;
  }

  public async handleUtterance(
    sessionId: string,
    input: UtteranceInput,
  ): Promise<HandleUtteranceResult> {
    const context = await this.sessions.getSession(sessionId);
    if (context === undefined) {
      return { ok: false, reason: 'session_not_found' };
    }

    const transcript = input.text;

    const now = this.clock();
    const userExchangeContext = addExchange(context, {
      role: 'user',
      text: transcript,
      timestamp: now,
    });

    const prevLatest =
      context.cumulativeEmotion.utteranceScores[
        context.cumulativeEmotion.utteranceScores.length - 1
      ];
    const latestForDialogue: EmotionAnalysisResult =
      prevLatest ?? { scores: NEUTRAL_SCORES, distortions: [], analyzedAt: now };

    let recalledDiaries: RecalledDiary[] = [];
    if (this.recall !== undefined) {
      try {
        recalledDiaries = await this.recall.recall(context.userId, transcript);
      } catch {
        recalledDiaries = [];
      }
    }

    const [calibrated, dialogue, modelOutput] = await Promise.all([
      this.emotion.analyze(
        { text: transcript },
        { sessionId: context.sessionId, userId: context.userId },
      ),
      this.generateDialogueSafe(transcript, userExchangeContext, latestForDialogue, recalledDiaries),
      this.riskModel !== undefined
        ? this.riskModel.assess(transcript)
        : Promise.resolve(undefined),
    ]);

    const utteranceResult: EmotionAnalysisResult = {
      scores: calibrated.combinedScores,
      distortions: dedupeDistortions(calibrated),
      analyzedAt: now,
    };
    const cumulativeEmotion = appendUtteranceResult(
      userExchangeContext.cumulativeEmotion,
      utteranceResult,
    );

    const { latest, nextState } = this.risk.evaluateUtterance(
      {
        text: transcript,
        emotionScores: calibrated.combinedScores,
        ...(modelOutput !== undefined
          ? { modelOutputs: { [SUICIDALITY_MODEL_OUTPUT_KEY]: modelOutput } }
          : {}),
      },
      context.riskState,
    );

    await this.safety.logRiskEvaluation(latest.combinedLevel, {
      sessionId: context.sessionId,
      userId: context.userId,
      triggeredSignals: latest.perSignal,
      occurredAt: now,
    });

    const forceFinalize = latest.combinedLevel === '고위험';

    const aiAppended = addExchange(
      { ...userExchangeContext, cumulativeEmotion, riskState: nextState },
      { role: 'ai', text: dialogue.aiResponse, timestamp: now },
    );
    const nextStage: ConversationStage = dialogue.degraded
      ? context.stage
      : dialogue.nextStage;
    const updated: SessionContext = { ...aiAppended, stage: nextStage };
    await this.sessions.saveSession(updated);

    return {
      ok: true,
      transcript,
      aiResponse: dialogue.aiResponse,
      emotion: calibrated,
      riskLevel: latest.combinedLevel,
      perSignal: latest.perSignal,
      stage: nextStage,
      forceFinalize,
      dialogueDegraded: dialogue.degraded,
    };
  }

  public async handleSilenceTimeout(
    sessionId: string,
    phase: 'first' | 'second',
  ): Promise<SilenceAction> {
    if (phase === 'first') {
      return { action: 'notify' };
    }
    const result = await this.endSession(sessionId, 'silence');
    return { action: 'ended', result };
  }

  public async endSession(
    sessionId: string,
    reason: EndReason,
  ): Promise<EndSessionResult> {
    const context = await this.sessions.getSession(sessionId);
    if (context === undefined) {
      throw new Error(`SessionOrchestrator.endSession: session "${sessionId}" not found`);
    }
    const endedAt = this.clock();
    const finalRiskLevel = context.riskState.current;
    const triggerContext = {
      sessionId: context.sessionId,
      userId: context.userId,
      triggeredSignals: context.riskState.perSignal.map((s) => ({
        signalId: s.signalId,
        level: s.level,
      })),
      occurredAt: endedAt,
    };

    if (finalRiskLevel === '고위험' || reason === 'high_risk') {
      if (reason === 'silence' || reason === 'error') {
        await this.safety.logHighRiskAbnormalEnd(triggerContext, reason);
      }
      await this.safety.triggerHigh(triggerContext);
    } else if (finalRiskLevel === '중위험') {
      await this.safety.triggerMedium(triggerContext);
    } else {
      await this.safety.triggerLow(
        context.cumulativeEmotion.aggregate,
        triggerContext,
        3,
        context.cumulativeEmotion.utteranceScores,
      );
    }

    let artifacts: ProducedArtifact[] = [];
    if (this.artifacts !== undefined) {
      const peakLevel: RiskLevel = context.riskState.highRiskTriggered
        ? '고위험'
        : context.riskState.current;
      const trajectory: RiskTrajectoryPoint[] = [
        {
          at: context.riskState.lastEvaluatedAt,
          level: peakLevel,
          perSignal: context.riskState.perSignal.map((s) => ({
            signalId: s.signalId,
            level: s.level,
          })),
        },
      ];
      const sessionResult = fromSessionContext(context, trajectory, endedAt);
      const consents = await this.resolveConsents(context.userId);
      artifacts = await this.artifacts.generateAndPersist(sessionResult, consents);
    }

    await this.sessions.deleteSession(sessionId);

    return { reason, sessionId, finalRiskLevel, artifacts };
  }

  private async generateDialogueSafe(
    userText: string,
    sessionContext: SessionContext,
    latestEmotion: EmotionAnalysisResult,
    recalledDiaries: RecalledDiary[],
  ): Promise<{ aiResponse: string; nextStage: ConversationStage; degraded: boolean }> {
    try {
      const result = await this.dialogue.generateResponse({
        userText,
        sessionContext,
        latestEmotion,
        ...(recalledDiaries.length > 0 ? { recalledDiaries } : {}),
      });
      return {
        aiResponse: result.aiResponse,
        nextStage: result.nextStage,
        degraded: false,
      };
    } catch {
      return {
        aiResponse: DIALOGUE_FALLBACK_RESPONSE,
        nextStage: sessionContext.stage,
        degraded: true,
      };
    }
  }

  private async resolveConsents(userId: string): Promise<ConsentSnapshot> {
    if (this.consentProvider !== undefined) {
      return this.consentProvider.getConsents(userId);
    }
    return { userId, granted: {} };
  }
}

function dedupeDistortions(calibrated: CalibratedEmotion): EmotionAnalysisResult['distortions'] {
  const seen = new Set<EmotionAnalysisResult['distortions'][number]>();
  for (const channel of calibrated.perChannel) {
    for (const d of channel.distortions ?? []) {
      seen.add(d);
    }
  }
  return [...seen];
}
