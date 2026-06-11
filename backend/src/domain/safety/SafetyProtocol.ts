// 3단계 화면 기반 안전 개입 도메인 서비스

import {
  COUNSELING_REFERRALS,
  EMERGENCY_PHONE_NUMBERS,
  EMOTION_CATEGORIES,
  tipsForEmotion,
  type CounselingReferral,
  type DailyTip,
  type EmotionAnalysisResult,
  type EmotionCategory,
  type EmotionScores,
  type RiskLevel,
} from '@nadaum/shared';

import type { NotificationPayload } from '../../adapters/notification/NotificationChannelAdapter.js';
import type {
  SafetyAuditEventType,
  SafetyAuditLogger,
  SafetyAuditPayload,
} from '../../adapters/persistence/SafetyAuditLogger.js';
import type { NotificationChannelRegistry } from '../notification/NotificationChannelRegistry.js';

// 고위험 강제 종료 시 안전 알림을 받을 보호자 1인
export interface NotifiableGuardian {
  readonly guardianId: string;
  readonly name: string;
  readonly email: string;
  readonly phone: string;
  readonly emailEnabled: boolean;
  readonly smsEnabled: boolean;
}

// 사용자별 보호자 알림 발송 계획
export interface GuardianNotificationPlan {
  readonly recipients: ReadonlyArray<NotifiableGuardian>;
  readonly enabledChannels: ReadonlySet<string>;
}

// 보호자 알림 발송 계획 조회 포트
export interface GuardianNotifier {
  resolveNotification(userId: string): Promise<GuardianNotificationPlan>;
}

export const HIGH_RISK_WARNING_MESSAGE =
  '지금 매우 힘드신 상태로 보입니다. 전문가의 즉각적인 도움이 필요할 수 있습니다.';

export const MEDIUM_RISK_RECOMMENDATION_MESSAGE =
  '최근 마음이 많이 무거우셨던 것 같아요. 전문 상담 기관의 도움을 받아보시는 것도 좋은 방법입니다.';

// 안전 프로토콜 트리거 공통 컨텍스트
export interface SafetyTriggerContext {
  readonly sessionId: string;
  readonly userId: string;
  readonly triggeredSignals?: ReadonlyArray<{
    readonly signalId: string;
    readonly level: RiskLevel;
  }>;
  readonly occurredAt?: Date;
}

// 저위험 개입 결과
export interface LowRiskResult {
  readonly level: '저위험';
  readonly topEmotion: EmotionCategory;
  readonly tips: DailyTip[];
  readonly auditLogged: boolean;
}

// 중위험 개입 결과
export interface MediumRiskResult {
  readonly level: '중위험';
  readonly referrals: readonly CounselingReferral[];
  readonly recommendation: string;
  readonly auditLogged: boolean;
}

// 고위험 개입 결과
export interface HighRiskResult {
  readonly level: '고위험';
  readonly emergencyContactsDisplayed: readonly ['1393', '1577-0199'];
  readonly warningMessage: string;
  readonly sessionForcedToFinalize: true;
  readonly auditLogged: boolean;
  readonly externalNotificationsSent: number;
}

export function highestEmotionCategory(scores: EmotionScores): EmotionCategory {
  let top: EmotionCategory = EMOTION_CATEGORIES[0];
  let topScore = scores[top];
  for (const category of EMOTION_CATEGORIES) {
    const score = scores[category];
    if (score > topScore) {
      top = category;
      topScore = score;
    }
  }
  return top;
}

const TIE_EPSILON = 1e-9;

function narrowByMax(
  candidates: readonly EmotionCategory[],
  valueOf: (c: EmotionCategory) => number,
): EmotionCategory[] {
  let max = Number.NEGATIVE_INFINITY;
  for (const c of candidates) {
    const v = valueOf(c);
    if (Number.isFinite(v) && v > max) {
      max = v;
    }
  }
  if (!Number.isFinite(max)) {
    return [...candidates];
  }
  return candidates.filter((c) => {
    const v = valueOf(c);
    return Number.isFinite(v) && Math.abs(v - max) <= TIE_EPSILON;
  });
}

function meanScore(
  utteranceScores: readonly EmotionAnalysisResult[],
  category: EmotionCategory,
): number {
  let sum = 0;
  let count = 0;
  for (const r of utteranceScores) {
    const v = r.scores[category];
    if (typeof v === 'number' && Number.isFinite(v)) {
      sum += v;
      count += 1;
    }
  }
  return count > 0 ? sum / count : Number.NEGATIVE_INFINITY;
}

function latestScore(
  utteranceScores: readonly EmotionAnalysisResult[],
  category: EmotionCategory,
): number {
  for (let i = utteranceScores.length - 1; i >= 0; i -= 1) {
    const v = utteranceScores[i]?.scores[category];
    if (typeof v === 'number' && Number.isFinite(v)) {
      return v;
    }
  }
  return Number.NEGATIVE_INFINITY;
}

function trendSlope(
  utteranceScores: readonly EmotionAnalysisResult[],
  category: EmotionCategory,
): number {
  let first: number | undefined;
  let last: number | undefined;
  let count = 0;
  for (const r of utteranceScores) {
    const v = r.scores[category];
    if (typeof v === 'number' && Number.isFinite(v)) {
      if (first === undefined) {
        first = v;
      }
      last = v;
      count += 1;
    }
  }
  if (count < 2 || first === undefined || last === undefined) {
    return Number.NEGATIVE_INFINITY;
  }
  return last - first;
}

export function resolveTopEmotion(
  scores: EmotionScores,
  utteranceScores: readonly EmotionAnalysisResult[] = [],
): EmotionCategory {
  let candidates = narrowByMax([...EMOTION_CATEGORIES], (c) => scores[c]);
  if (candidates.length === 1) {
    return candidates[0] as EmotionCategory;
  }

  if (utteranceScores.length > 0) {
    candidates = narrowByMax(candidates, (c) => meanScore(utteranceScores, c));
    if (candidates.length === 1) {
      return candidates[0] as EmotionCategory;
    }
    candidates = narrowByMax(candidates, (c) => latestScore(utteranceScores, c));
    if (candidates.length === 1) {
      return candidates[0] as EmotionCategory;
    }
    candidates = narrowByMax(candidates, (c) => trendSlope(utteranceScores, c));
    if (candidates.length === 1) {
      return candidates[0] as EmotionCategory;
    }
  }

  return candidates[0] as EmotionCategory;
}

// SafetyProtocol 생성자 옵션
export interface SafetyProtocolOptions {
  readonly auditLogger: SafetyAuditLogger;
  readonly notificationRegistry: NotificationChannelRegistry;
  readonly guardianNotifier?: GuardianNotifier;
  readonly random?: () => number;
}

// 3단계 화면 기반 안전 개입 서비스
export class SafetyProtocol {
  private readonly auditLogger: SafetyAuditLogger;
  private readonly notificationRegistry: NotificationChannelRegistry;
  private readonly guardianNotifier: GuardianNotifier | undefined;
  private readonly random: () => number;

  public constructor(options: SafetyProtocolOptions) {
    this.auditLogger = options.auditLogger;
    this.notificationRegistry = options.notificationRegistry;
    this.guardianNotifier = options.guardianNotifier;
    this.random = options.random ?? Math.random;
  }

  public async triggerLow(
    scores: EmotionScores,
    context: SafetyTriggerContext,
    tipCount = 3,
    utteranceScores: readonly EmotionAnalysisResult[] = [],
  ): Promise<LowRiskResult> {
    const topEmotion = resolveTopEmotion(scores, utteranceScores);
    const tips = tipsForEmotion(topEmotion, tipCount, this.random);

    const auditLogged = await this.logSafe('low_intervention', '저위험', context, {
      daily_tips: tips.map((t) => t.id),
    });

    return { level: '저위험', topEmotion, tips, auditLogged };
  }

  public async triggerMedium(context: SafetyTriggerContext): Promise<MediumRiskResult> {
    const referrals = COUNSELING_REFERRALS;

    const auditLogged = await this.logSafe('medium_intervention', '중위험', context, {
      referrals: referrals.map((r) => r.id),
    });

    return {
      level: '중위험',
      referrals,
      recommendation: MEDIUM_RISK_RECOMMENDATION_MESSAGE,
      auditLogged,
    };
  }

  public async triggerHigh(context: SafetyTriggerContext): Promise<HighRiskResult> {
    const channels = this.notificationRegistry.list();

    let plan: GuardianNotificationPlan = { recipients: [], enabledChannels: new Set() };
    if (this.guardianNotifier !== undefined && channels.length > 0) {
      try {
        plan = await this.guardianNotifier.resolveNotification(context.userId);
      } catch {
        plan = { recipients: [], enabledChannels: new Set() };
      }
    }

    let sent = 0;
    let failed = 0;
    for (const channel of channels) {
      if (!plan.enabledChannels.has(channel.channelId)) continue;
      for (const guardian of plan.recipients) {
        const guardianAllows =
          channel.channelId === 'email'
            ? guardian.emailEnabled
            : channel.channelId === 'sms'
              ? guardian.smsEnabled
              : true;
        if (!guardianAllows) continue;
        const payload: NotificationPayload = {
          userId: context.userId,
          guardianId: guardian.guardianId,
          recipientEmail: guardian.email,
          recipientPhone: guardian.phone,
          templateId: 'high_risk_guardian_alert',
          vars: {},
        };
        try {
          const result = await channel.send(payload);
          if (result.status === 'success') sent += 1;
          else failed += 1;
        } catch {
          failed += 1;
        }
      }
    }

    const auditLogged = await this.logSafe('high_intervention', '고위험', context, {
      displayed_contacts: [...EMERGENCY_PHONE_NUMBERS],
      warning_message: HIGH_RISK_WARNING_MESSAGE,
      session_forced_to_finalize: true,
      notifications_sent: sent,
      notifications_failed: failed,
      notification_recipients: plan.recipients.length,
      notification_channels: [...plan.enabledChannels],
    });

    return {
      level: '고위험',
      emergencyContactsDisplayed: EMERGENCY_PHONE_NUMBERS,
      warningMessage: HIGH_RISK_WARNING_MESSAGE,
      sessionForcedToFinalize: true,
      auditLogged,
      externalNotificationsSent: sent,
    };
  }

  public async logRiskEvaluation(
    level: RiskLevel,
    context: SafetyTriggerContext,
  ): Promise<boolean> {
    return this.logSafe('risk_evaluated', level, context, {});
  }

  public async logHighRiskAbnormalEnd(
    context: SafetyTriggerContext,
    reason: string,
  ): Promise<boolean> {
    return this.logSafe('high_intervention_abnormal_end', '고위험', context, { reason });
  }

  private async logSafe(
    eventType: SafetyAuditEventType,
    riskLevel: RiskLevel,
    context: SafetyTriggerContext,
    extraPayload: SafetyAuditPayload,
  ): Promise<boolean> {
    const payload: SafetyAuditPayload = {
      risk_level: riskLevel,
      ...(context.triggeredSignals !== undefined
        ? { triggered_signals: context.triggeredSignals }
        : {}),
      ...extraPayload,
    };
    try {
      await this.auditLogger.logEvent({
        sessionId: context.sessionId,
        userId: context.userId,
        eventType,
        riskLevel,
        payload,
        ...(context.occurredAt !== undefined ? { occurredAt: context.occurredAt } : {}),
      });
      return true;
    } catch {
      return false;
    }
  }
}
