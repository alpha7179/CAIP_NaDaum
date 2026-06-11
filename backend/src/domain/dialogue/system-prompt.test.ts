// buildSystemPrompt() 단위 테스트

import type { EmotionAnalysisResult, Exchange } from '@nadaum/shared';
import { describe, expect, it } from 'vitest';


import {
  SYSTEM_PROMPT_RECENT_EXCHANGES_LIMIT,
  buildSystemPrompt,
} from './system-prompt.js';

const baseEmotion: EmotionAnalysisResult = {
  scores: {
    기쁨: 2,
    슬픔: 7,
    분노: 3,
    불안: 6,
    놀람: 1,
    혐오: 1,
    중립: 4,
  },
  distortions: ['파국화'],
  analyzedAt: new Date('2025-01-01T00:00:00Z'),
};

function makeExchanges(n: number): Exchange[] {
  const out: Exchange[] = [];
  for (let i = 0; i < n; i += 1) {
    out.push({
      role: i % 2 === 0 ? 'user' : 'ai',
      text: `발화 ${i}`,
      timestamp: new Date(`2025-01-01T00:${String(i).padStart(2, '0')}:00Z`),
    });
  }
  return out;
}

describe('buildSystemPrompt', () => {
  it('모든 필수 섹션 헤더를 포함한다', () => {
    const prompt = buildSystemPrompt({
      stage: '감정탐색',
      latestEmotion: baseEmotion,
      recentExchanges: makeExchanges(3),
      isMedicalRedirect: false,
    });

    expect(prompt).toContain('[역할]');
    expect(prompt).toContain('[금지 행위]');
    expect(prompt).toContain('[필수 행동]');
    expect(prompt).toContain('[현재 단계]');
    expect(prompt).toContain('[최근 감정 분석]');
    expect(prompt).toContain('[대화 이력');
    expect(prompt).toContain('[의료 키워드 감지 분기');
  });

  it('의학적 진단·약물·치료 처방 금지 규칙을 명시한다', () => {
    const prompt = buildSystemPrompt({
      stage: '상황파악',
      latestEmotion: baseEmotion,
      recentExchanges: [],
      isMedicalRedirect: false,
    });

    expect(prompt).toContain('의학적 진단명');
    expect(prompt).toContain('약물 복용');
    expect(prompt).toMatch(/치료 기법|치료 처방/);
  });

  it('isMedicalRedirect=true이면 의료 분기 활성 안내를 포함한다', () => {
    const prompt = buildSystemPrompt({
      stage: '감정탐색',
      latestEmotion: baseEmotion,
      recentExchanges: [],
      isMedicalRedirect: true,
    });

    expect(prompt).toContain('의료 키워드 감지 분기 — 활성');
    expect(prompt).toContain('전문 정신건강 상담 기관');
  });

  it('isMedicalRedirect=false이면 의료 분기 비활성 안내를 포함한다', () => {
    const prompt = buildSystemPrompt({
      stage: '감정탐색',
      latestEmotion: baseEmotion,
      recentExchanges: [],
      isMedicalRedirect: false,
    });

    expect(prompt).toContain('의료 키워드 감지 분기 — 비활성');
  });

  it('현재 단계 텍스트를 포함한다', () => {
    const prompt = buildSystemPrompt({
      stage: '패턴연결',
      latestEmotion: baseEmotion,
      recentExchanges: [],
      isMedicalRedirect: false,
    });

    expect(prompt).toContain('패턴연결');
  });

  it('최근 감정 점수 7가지를 모두 직렬화한다', () => {
    const prompt = buildSystemPrompt({
      stage: '감정탐색',
      latestEmotion: baseEmotion,
      recentExchanges: [],
      isMedicalRedirect: false,
    });

    expect(prompt).toContain('기쁨=2');
    expect(prompt).toContain('슬픔=7');
    expect(prompt).toContain('분노=3');
    expect(prompt).toContain('불안=6');
    expect(prompt).toContain('놀람=1');
    expect(prompt).toContain('혐오=1');
    expect(prompt).toContain('중립=4');
    expect(prompt).toContain('파국화');
  });

  it('latestEmotion이 없으면 결과 없음을 명시한다', () => {
    const prompt = buildSystemPrompt({
      stage: '상황파악',
      latestEmotion: undefined,
      recentExchanges: [],
      isMedicalRedirect: false,
    });

    expect(prompt).toContain('직전 발화에 대한 감정 분석 결과가 아직 없습니다');
  });

  it('대화 이력이 최대 10개로 컷오프된다', () => {
    const exchanges = makeExchanges(15);
    const prompt = buildSystemPrompt({
      stage: '감정탐색',
      latestEmotion: baseEmotion,
      recentExchanges: exchanges,
      isMedicalRedirect: false,
    });

    for (let i = 5; i < 15; i += 1) {
      expect(prompt).toContain(`발화 ${i}`);
    }
    expect(prompt).not.toMatch(/발화 0(?!\d)/);
    expect(prompt).not.toMatch(/발화 1(?!\d)/);
    expect(prompt).not.toMatch(/발화 2(?!\d)/);
    expect(prompt).not.toMatch(/발화 3(?!\d)/);
    expect(prompt).not.toMatch(/발화 4(?!\d)/);
  });

  it('대화 이력이 없으면 그 사실을 명시한다', () => {
    const prompt = buildSystemPrompt({
      stage: '상황파악',
      latestEmotion: baseEmotion,
      recentExchanges: [],
      isMedicalRedirect: false,
    });

    expect(prompt).toContain('직전 대화 이력이 없습니다');
  });

  it('동일 입력에 대해 결정적으로 동일한 텍스트를 반환한다', () => {
    const args = {
      stage: '생각탐색' as const,
      latestEmotion: baseEmotion,
      recentExchanges: makeExchanges(5),
      isMedicalRedirect: true,
    };

    const a = buildSystemPrompt(args);
    const b = buildSystemPrompt(args);
    expect(a).toBe(b);
  });

  it('SYSTEM_PROMPT_RECENT_EXCHANGES_LIMIT는 10이다', () => {
    expect(SYSTEM_PROMPT_RECENT_EXCHANGES_LIMIT).toBe(10);
  });
});
