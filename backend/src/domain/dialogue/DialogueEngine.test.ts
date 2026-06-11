// DialogueEngine 도메인 결정 함수 통합 단위 테스트

import type {
  CalibratedEmotion,
  EmotionAnalysisResult,
  EmotionScores,
  RiskState,
  SessionContext,
} from '@nadaum/shared';
import { describe, expect, it } from 'vitest';


import {
  DialogueEngineImpl,
  type DialogueGenerator,
  type DialogueGeneratorInput,
  type DialogueGeneratorOutput,
} from './DialogueEngine.js';
import { buildSystemPrompt } from './system-prompt.js';

const baseScores: EmotionScores = {
  기쁨: 1,
  슬픔: 5,
  분노: 3,
  불안: 5,
  놀람: 1,
  혐오: 1,
  중립: 5,
};

const baseEmotion: EmotionAnalysisResult = {
  scores: baseScores,
  distortions: [],
  analyzedAt: new Date('2025-01-01T00:00:00Z'),
};

const baseCalibrated: CalibratedEmotion = {
  combinedScores: baseScores,
  perChannel: [],
  missingChannels: [],
  policy: 'text_only',
};

const baseRiskState: RiskState = {
  current: '저위험',
  consecutiveLowerCount: 0,
  lastEvaluatedAt: new Date('2025-01-01T00:00:00Z'),
  highRiskTriggered: false,
  perSignal: [],
};

function makeContext(overrides: Partial<SessionContext> = {}): SessionContext {
  return {
    sessionId: 'session-1',
    userId: 'user-1',
    stage: '상황파악',
    exchanges: [],
    cumulativeEmotion: { utteranceScores: [], aggregate: baseScores },
    riskState: baseRiskState,
    startedAt: new Date('2025-01-01T00:00:00Z'),
    lastUtteranceAt: new Date('2025-01-01T00:00:00Z'),
    ...overrides,
  };
}

class FakeGenerator implements DialogueGenerator {
  public lastInput?: DialogueGeneratorInput;

  constructor(private readonly response = '잘 들었어요. 더 이야기해 주실 수 있을까요?') {}

  async generate(input: DialogueGeneratorInput): Promise<DialogueGeneratorOutput> {
    this.lastInput = input;
    return { aiResponse: this.response };
  }
}

describe('DialogueEngineImpl', () => {
  it('교환이 없는 첫 발화에서는 단계가 유지된다', async () => {
    const generator = new FakeGenerator();
    const engine = new DialogueEngineImpl(generator);
    const context = makeContext({ stage: '상황파악', exchanges: [] });

    const result = await engine.generateResponse({
      userText: '오늘 좀 답답했어',
      sessionContext: context,
      latestEmotion: baseEmotion,
    });

    expect(result.nextStage).toBe('상황파악');
    expect(result.isMedicalRedirect).toBe(false);
  });

  it('직전 사용자 발화가 있으면 다음 단계로 전진한다', async () => {
    const generator = new FakeGenerator();
    const engine = new DialogueEngineImpl(generator);
    const context = makeContext({
      stage: '상황파악',
      exchanges: [
        { role: 'user', text: '오늘 답답했어', timestamp: new Date() },
        { role: 'ai', text: '어떤 일이 있었나요?', timestamp: new Date() },
      ],
    });

    const result = await engine.generateResponse({
      userText: '회사에서 다툼이 있었어',
      sessionContext: context,
      latestEmotion: baseEmotion,
    });

    expect(result.nextStage).toBe('감정탐색');
  });

  it('종료 의사 감지 시 부드러운마무리로 전환한다', async () => {
    const generator = new FakeGenerator();
    const engine = new DialogueEngineImpl(generator);
    const context = makeContext({ stage: '상황파악' });

    const result = await engine.generateResponse({
      userText: '이제 그만할게',
      sessionContext: context,
      latestEmotion: baseEmotion,
    });

    expect(result.nextStage).toBe('부드러운마무리');
    expect(generator.lastInput?.endIntent).toBe(true);
  });

  it('의료 키워드 감지 시 isMedicalRedirect가 true이고 어댑터 입력에도 전달된다', async () => {
    const generator = new FakeGenerator();
    const engine = new DialogueEngineImpl(generator);
    const context = makeContext({ stage: '감정탐색' });

    const result = await engine.generateResponse({
      userText: '제가 우울증인가요? 항우울제를 먹어야 할까요?',
      sessionContext: context,
      latestEmotion: baseEmotion,
    });

    expect(result.isMedicalRedirect).toBe(true);
    expect(generator.lastInput?.medicalDetection.isMedicalRedirect).toBe(true);
    expect(generator.lastInput?.medicalDetection.matchedCategories).toEqual(
      expect.arrayContaining(['diagnosis', 'medication']),
    );
  });

  it('detectEndIntent / detectMedicalKeywords 위임 메서드가 동일하게 동작한다', () => {
    const engine = new DialogueEngineImpl(new FakeGenerator());
    expect(engine.detectEndIntent('이제 그만할게')).toBe(true);
    expect(engine.detectEndIntent('오늘 힘들었어')).toBe(false);
    expect(engine.detectMedicalKeywords('SSRI 처방받았어요')).toBe(true);
    expect(engine.detectMedicalKeywords('오늘 산책했어')).toBe(false);
  });

  it('의료 키워드 감지가 buildSystemPrompt 입력 형상으로 전달되어 비의료 안내 분기를 활성화한다', async () => {
    let capturedPrompt = '';
    const promptingGenerator: DialogueGenerator = {
      async generate(input) {
        capturedPrompt = buildSystemPrompt({
          stage: input.stage,
          latestEmotion: input.latestEmotion,
          recentExchanges: input.recentExchanges,
          isMedicalRedirect: input.medicalDetection.isMedicalRedirect,
        });
        return { aiResponse: 'ok' };
      },
    };

    const engine = new DialogueEngineImpl(promptingGenerator);
    const context = makeContext({ stage: '감정탐색' });

    const result = await engine.generateResponse({
      userText: '제가 양극성장애일까요? 자낙스를 먹어야 할까요?',
      sessionContext: context,
      latestEmotion: baseEmotion,
    });

    expect(result.isMedicalRedirect).toBe(true);
    expect(capturedPrompt).toContain('의료 키워드 감지 분기 — 활성');
    expect(capturedPrompt).toContain('전문 정신건강 상담 기관');
    expect(capturedPrompt).toContain('의학적 진단명');
    expect(capturedPrompt).toContain('약물 복용');
  });

  it('의료 키워드가 없으면 시스템 프롬프트는 비활성 분기로 구성된다', async () => {
    let capturedPrompt = '';
    const promptingGenerator: DialogueGenerator = {
      async generate(input) {
        capturedPrompt = buildSystemPrompt({
          stage: input.stage,
          latestEmotion: input.latestEmotion,
          recentExchanges: input.recentExchanges,
          isMedicalRedirect: input.medicalDetection.isMedicalRedirect,
        });
        return { aiResponse: 'ok' };
      },
    };

    const engine = new DialogueEngineImpl(promptingGenerator);
    const result = await engine.generateResponse({
      userText: '오늘 친구랑 다투고 마음이 무거워',
      sessionContext: makeContext({ stage: '상황파악' }),
      latestEmotion: baseEmotion,
    });

    expect(result.isMedicalRedirect).toBe(false);
    expect(capturedPrompt).toContain('의료 키워드 감지 분기 — 비활성');
  });

  void baseCalibrated;
});
