// DiaryProducer 단위 테스트
import {
  DIARY_FULL_BODY_MAX_LENGTH,
  DIARY_FULL_BODY_MIN_LENGTH,
  type CalibratedEmotion,
  type EmotionScores,
  type Exchange,
  type SessionResult,
} from '@nadaum/shared';
import { describe, expect, it } from 'vitest';


import {
  DiaryProducer,
  buildDiaryPrompt,
  type DiaryAIGateway,
  type DiaryGatewayRequest,
  type DiaryGatewayResponse,
} from './DiaryProducer.js';

const scores: EmotionScores = {
  기쁨: 2,
  슬픔: 8,
  분노: 3,
  불안: 5,
  놀람: 1,
  혐오: 2,
  중립: 4,
};

const calibrated: CalibratedEmotion = {
  combinedScores: scores,
  perChannel: [],
  missingChannels: [],
  policy: 'text_only',
};

function makeSession(userUtteranceCount: number): SessionResult {
  const exchanges: Exchange[] = [];
  for (let i = 0; i < userUtteranceCount; i += 1) {
    exchanges.push({ role: 'user', text: `사용자 발화 ${i}`, timestamp: new Date() });
    exchanges.push({ role: 'ai', text: `AI 응답 ${i}`, timestamp: new Date() });
  }
  return {
    sessionId: 'sess-1',
    userId: 'user-1',
    exchanges,
    cumulativeEmotion: calibrated,
    distortions: [],
    riskTrajectory: [],
    endedAt: new Date('2026-05-28T09:30:00.000Z'),
  };
}

function fakeGateway(
  responder: (attempt: number, req: DiaryGatewayRequest) => DiaryGatewayResponse,
): DiaryAIGateway & { calls: DiaryGatewayRequest[] } {
  const calls: DiaryGatewayRequest[] = [];
  return {
    calls,
    async callExternalAI(
      _t: 'gpt4o_diary',
      req: DiaryGatewayRequest,
    ): Promise<DiaryGatewayResponse> {
      calls.push(req);
      return responder(calls.length, req);
    },
  };
}

let idCounter = 0;
const idFactory = (): string => `diary-${(idCounter += 1)}`;
const clock = (): Date => new Date('2026-05-28T09:31:00.000Z');

describe('buildDiaryPrompt', () => {
  it('preserves the conversation transcript', () => {
    const session = makeSession(2);
    const prompt = buildDiaryPrompt(session, 'brief');
    expect(prompt).toContain('사용자 발화 0');
    expect(prompt).toContain('AI 응답 1');
    expect(prompt).toContain('1인칭');
  });
});

describe('DiaryProducer', () => {
  it('exposes artifactType="emotion_diary"', () => {
    const producer = new DiaryProducer({ gateway: fakeGateway(() => ({ text: 'x' })), idFactory });
    expect(producer.artifactType).toBe('emotion_diary');
  });

  it('routes through gateway.callExternalAI("gpt4o_diary", ...)', async () => {
    const longBody = '나는 '.repeat(80) + '오늘 하루를 돌아보았다.';
    const gateway = fakeGateway(() => ({ text: longBody }));
    const producer = new DiaryProducer({ gateway, idFactory, clock, retryDelayMs: 0 });
    await producer.produce(makeSession(3));
    expect(gateway.calls).toHaveLength(1);
    expect(gateway.calls[0]?.prompt).toContain('대화 원문');
  });

  it('produces a full body (200~1000 chars) when user utterances >= 3', async () => {
    const longBody = '나는 오늘 여러 감정을 느꼈다. '.repeat(20);
    const gateway = fakeGateway(() => ({ text: longBody }));
    const producer = new DiaryProducer({ gateway, idFactory, clock, retryDelayMs: 0 });
    const diary = await producer.produce(makeSession(3));
    expect(diary.bodyType).toBe('full');
    expect(diary.body.length).toBeGreaterThanOrEqual(DIARY_FULL_BODY_MIN_LENGTH);
    expect(diary.body.length).toBeLessThanOrEqual(DIARY_FULL_BODY_MAX_LENGTH);
    expect(diary.emotionScores.슬픔).toBe(8);
    expect(diary.sessionDate).toBe('2026-05-28');
    expect(diary.diaryId).toMatch(/^diary-/);
  });

  it('produces a brief body when user utterances < 3', async () => {
    const gateway = fakeGateway(() => ({ text: '나는 오늘 조금 지쳤지만 괜찮아지려 한다.' }));
    const producer = new DiaryProducer({ gateway, idFactory, clock, retryDelayMs: 0 });
    const diary = await producer.produce(makeSession(2));
    expect(diary.bodyType).toBe('brief');
    expect(diary.body.length).toBeGreaterThan(0);
  });

  it('applies sanitize, preserving the dominant emotion', async () => {
    const gateway = fakeGateway(() => ({ text: '나는 다 부숴버리고 싶었다' }));
    const producer = new DiaryProducer({ gateway, idFactory, clock, retryDelayMs: 0 });
    const diary = await producer.produce(makeSession(2));
    expect(diary.body).not.toContain('부숴버리고');
    expect(diary.body).toContain('마음이 무거웠다');
  });

  it('regenerates a too-short full body then accepts a valid one', async () => {
    const shortBody = '짧은 일기';
    const longBody = '나는 오늘 하루를 천천히 돌아보았다. '.repeat(15);
    const gateway = fakeGateway((attempt) => (attempt < 2 ? { text: shortBody } : { text: longBody }));
    const producer = new DiaryProducer({ gateway, idFactory, clock, retryDelayMs: 0 });
    const diary = await producer.produce(makeSession(5));
    expect(gateway.calls.length).toBeGreaterThanOrEqual(2);
    expect(diary.body.length).toBeGreaterThanOrEqual(DIARY_FULL_BODY_MIN_LENGTH);
  });

  it('retries on transient gateway error', async () => {
    const longBody = '나는 오늘 하루를 천천히 돌아보았다. '.repeat(15);
    const gateway = fakeGateway((attempt) => {
      if (attempt < 2) {
        throw new Error('transient');
      }
      return { text: longBody };
    });
    const producer = new DiaryProducer({ gateway, idFactory, clock, retryDelayMs: 0 });
    const diary = await producer.produce(makeSession(3));
    expect(gateway.calls).toHaveLength(2);
    expect(diary.bodyType).toBe('full');
  });

  it('records peakRiskLevel from session.riskTrajectory (공유 차단 게이트)', async () => {
    const longBody = '나는 오늘 하루를 천천히 돌아보았다. '.repeat(15);
    const gateway = fakeGateway(() => ({ text: longBody }));
    const producer = new DiaryProducer({ gateway, idFactory, clock, retryDelayMs: 0 });

    const baseSession = makeSession(3);
    const lowRisk = await producer.produce(baseSession);
    expect(lowRisk.peakRiskLevel).toBe('저위험');

    const highRiskSession: SessionResult = {
      ...baseSession,
      riskTrajectory: [
        { at: new Date(), level: '저위험', perSignal: [] },
        { at: new Date(), level: '고위험', perSignal: [] },
      ],
    };
    const highRisk = await producer.produce(highRiskSession);
    expect(highRisk.peakRiskLevel).toBe('고위험');
  });
});
