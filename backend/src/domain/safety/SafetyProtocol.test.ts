// SafetyProtocol 단위 테스트
import { EMERGENCY_PHONE_NUMBERS, type EmotionAnalysisResult, type EmotionScores } from '@nadaum/shared';
import { describe, expect, it } from 'vitest';


import { InMemorySafetyAuditLogger } from '../../adapters/persistence/SafetyAuditLogger.js';
import { NotificationChannelRegistry } from '../notification/NotificationChannelRegistry.js';

import {
  HIGH_RISK_WARNING_MESSAGE,
  SafetyProtocol,
  highestEmotionCategory,
  resolveTopEmotion,
} from './SafetyProtocol.js';

const context = { sessionId: 'sess-1', userId: 'user-1' };

function makeProtocol(): {
  protocol: SafetyProtocol;
  audit: InMemorySafetyAuditLogger;
  registry: NotificationChannelRegistry;
} {
  const audit = new InMemorySafetyAuditLogger();
  const registry = new NotificationChannelRegistry();
  const protocol = new SafetyProtocol({
    auditLogger: audit,
    notificationRegistry: registry,
    random: () => 0,
  });
  return { protocol, audit, registry };
}

const scores: EmotionScores = {
  기쁨: 2,
  슬픔: 9,
  분노: 3,
  불안: 5,
  놀람: 1,
  혐오: 2,
  중립: 4,
};

describe('highestEmotionCategory', () => {
  it('returns the highest-scoring category', () => {
    expect(highestEmotionCategory(scores)).toBe('슬픔');
  });

  it('breaks ties deterministically by EMOTION_CATEGORIES order', () => {
    const flat: EmotionScores = {
      기쁨: 5,
      슬픔: 5,
      분노: 5,
      불안: 5,
      놀람: 5,
      혐오: 5,
      중립: 5,
    };
    expect(highestEmotionCategory(flat)).toBe('기쁨');
  });
});

describe('resolveTopEmotion (다단계 결정적 동점 처리)', () => {
  function fill(base: number, overrides: Partial<EmotionScores> = {}): EmotionScores {
    return {
      기쁨: base,
      슬픔: base,
      분노: base,
      불안: base,
      놀람: base,
      혐오: base,
      중립: base,
      ...overrides,
    };
  }

  function utterance(scores: EmotionScores): EmotionAnalysisResult {
    return { scores, distortions: [], analyzedAt: new Date('2026-05-28T00:00:00.000Z') };
  }

  it('이력이 없으면 정수 점수 단독 판정으로 폴백한다(highestEmotionCategory와 동일)', () => {
    expect(resolveTopEmotion(scores)).toBe('슬픔');
    expect(resolveTopEmotion(fill(5))).toBe('기쁨');
  });

  it('1차: 정수 동점 시 라운딩 전 실수 평균이 높은 범주를 채택한다', () => {
    const aggregate = fill(2, { 슬픔: 8, 불안: 8 });
    const history = [
      utterance(fill(2, { 슬픔: 8, 불안: 8 })),
      utterance(fill(2, { 슬픔: 9, 불안: 8 })),
      utterance(fill(2, { 슬픔: 8, 불안: 8 })),
    ];
    expect(resolveTopEmotion(aggregate, history)).toBe('슬픔');
  });

  it('2차: 정수·평균까지 동점이면 최신 발화 점수(recency)로 가린다', () => {
    const aggregate = fill(2, { 슬픔: 8, 불안: 8 });
    const history = [
      utterance(fill(2, { 슬픔: 9, 불안: 7 })),
      utterance(fill(2, { 슬픔: 7, 불안: 9 })),
    ];
    expect(resolveTopEmotion(aggregate, history)).toBe('불안');
  });

  it('3차: 정수·평균·최신까지 동점이면 상승 추세(trajectory)로 가린다', () => {
    const aggregate = fill(2, { 슬픔: 8, 불안: 8 });
    const history = [
      utterance(fill(2, { 슬픔: 9, 불안: 7 })),
      utterance(fill(2, { 슬픔: 8, 불안: 10 })),
      utterance(fill(2, { 슬픔: 7, 불안: 7 })),
    ];
    expect(resolveTopEmotion(aggregate, history)).toBe('불안');
  });

  it('모든 단계가 동점이면 정의 순서가 빠른 범주로 결정적으로 폴백한다', () => {
    const aggregate = fill(2, { 슬픔: 8, 불안: 8 });
    const history = [utterance(fill(2, { 슬픔: 8, 불안: 8 }))];
    expect(resolveTopEmotion(aggregate, history)).toBe('슬픔');
  });

  it('동일 입력에 대해 항상 같은 결과를 반환한다(결정성)', () => {
    const aggregate = fill(2, { 슬픔: 8, 불안: 8 });
    const history = [
      utterance(fill(2, { 슬픔: 8, 불안: 9 })),
      utterance(fill(2, { 슬픔: 9, 불안: 8 })),
    ];
    const first = resolveTopEmotion(aggregate, history);
    for (let i = 0; i < 20; i += 1) {
      expect(resolveTopEmotion(aggregate, history)).toBe(first);
    }
  });
});

describe('SafetyProtocol.triggerLow', () => {
  it('returns 1~3 tips matching the top emotion and logs one audit row', async () => {
    const { protocol, audit } = makeProtocol();
    const result = await protocol.triggerLow(scores, context, 3);

    expect(result.level).toBe('저위험');
    expect(result.topEmotion).toBe('슬픔');
    expect(result.tips.length).toBeGreaterThanOrEqual(1);
    expect(result.tips.length).toBeLessThanOrEqual(3);
    for (const tip of result.tips) {
      expect(tip.category).toBe('슬픔');
    }
    expect(result.auditLogged).toBe(true);

    const rows = audit.listBySession('sess-1');
    expect(rows).toHaveLength(1);
    expect(rows[0]?.eventType).toBe('low_intervention');
    expect(rows[0]?.riskLevel).toBe('저위험');
  });
});

describe('SafetyProtocol.triggerMedium', () => {
  it('returns predefined counseling referrals and logs one audit row', async () => {
    const { protocol, audit } = makeProtocol();
    const result = await protocol.triggerMedium(context);

    expect(result.level).toBe('중위험');
    expect(result.referrals.length).toBeGreaterThan(0);
    expect(result.recommendation.length).toBeGreaterThan(0);
    expect(result.auditLogged).toBe(true);

    const rows = audit.listBySession('sess-1');
    expect(rows).toHaveLength(1);
    expect(rows[0]?.eventType).toBe('medium_intervention');
  });
});

describe('SafetyProtocol.triggerHigh', () => {
  it('returns fixed emergency contacts, warning, forced finalize, and sends 0 external notifications', async () => {
    const { protocol, audit } = makeProtocol();
    const result = await protocol.triggerHigh(context);

    expect(result.level).toBe('고위험');
    expect(result.emergencyContactsDisplayed).toEqual(['1393', '1577-0199']);
    expect(result.emergencyContactsDisplayed).toEqual([...EMERGENCY_PHONE_NUMBERS]);
    expect(result.warningMessage).toBe(HIGH_RISK_WARNING_MESSAGE);
    expect(result.warningMessage.length).toBeGreaterThan(0);
    expect(result.sessionForcedToFinalize).toBe(true);
    expect(result.externalNotificationsSent).toBe(0);
    expect(result.auditLogged).toBe(true);

    const rows = audit.listBySession('sess-1');
    expect(rows).toHaveLength(1);
    expect(rows[0]?.eventType).toBe('high_intervention');
    expect(rows[0]?.payload['displayed_contacts']).toEqual(['1393', '1577-0199']);
  });
});

describe('SafetyProtocol audit best-effort', () => {
  it('still returns the high-risk safety result when audit logging fails', async () => {
    const failingLogger = {
      async logEvent(): Promise<void> {
        throw new Error('db down');
      },
    };
    const protocol = new SafetyProtocol({
      auditLogger: failingLogger,
      notificationRegistry: new NotificationChannelRegistry(),
    });
    const result = await protocol.triggerHigh(context);
    expect(result.emergencyContactsDisplayed).toEqual(['1393', '1577-0199']);
    expect(result.auditLogged).toBe(false);
  });
});

describe('SafetyProtocol.logRiskEvaluation / logHighRiskAbnormalEnd', () => {
  it('records risk_evaluated and high_intervention_abnormal_end as single rows', async () => {
    const { protocol, audit } = makeProtocol();
    await protocol.logRiskEvaluation('중위험', context);
    await protocol.logHighRiskAbnormalEnd(context, 'silence_timeout');

    const rows = audit.listBySession('sess-1');
    expect(rows).toHaveLength(2);
    expect(rows[0]?.eventType).toBe('risk_evaluated');
    expect(rows[1]?.eventType).toBe('high_intervention_abnormal_end');
    expect(rows[1]?.payload['reason']).toBe('silence_timeout');
  });
});
