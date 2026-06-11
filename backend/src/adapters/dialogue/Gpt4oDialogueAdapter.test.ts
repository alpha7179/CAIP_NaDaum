// Gpt4oDialogueAdapter 단위 테스트
import type { EmotionAnalysisResult } from '@nadaum/shared';
import { describe, expect, it } from 'vitest';


import type { DialogueGeneratorInput } from '../../domain/dialogue/DialogueEngine.js';

import {
  DialogueExhaustedError,
  Gpt4oDialogueAdapter,
  type DialogueAIGateway,
  type DialogueGatewayRequest,
  type DialogueGatewayResponse,
} from './Gpt4oDialogueAdapter.js';

const latestEmotion: EmotionAnalysisResult = {
  scores: {
    기쁨: 2,
    슬픔: 8,
    분노: 4,
    불안: 7,
    놀람: 3,
    혐오: 3,
    중립: 5,
  },
  distortions: ['파국화'],
  analyzedAt: new Date('2026-05-28T00:00:00.000Z'),
};

function baseInput(overrides: Partial<DialogueGeneratorInput> = {}): DialogueGeneratorInput {
  return {
    userText: '오늘 너무 지치고 힘들었어요.',
    stage: '감정탐색',
    latestEmotion,
    recentExchanges: [],
    medicalDetection: {
      isMedicalRedirect: false,
      matchedCategories: [],
      matchedKeywords: [],
    },
    endIntent: false,
    ...overrides,
  };
}

type GatewayResult = DialogueGatewayResponse | { response: DialogueGatewayResponse };

function fakeGateway(
  responder: (
    attempt: number,
    req: DialogueGatewayRequest,
  ) => Promise<GatewayResult> | GatewayResult,
): DialogueAIGateway & { calls: DialogueGatewayRequest[] } {
  const calls: DialogueGatewayRequest[] = [];
  return {
    calls,
    async callExternalAI(
      _target: 'gpt4o_dialogue',
      req: DialogueGatewayRequest,
    ): Promise<GatewayResult> {
      calls.push(req);
      return await responder(calls.length, req);
    },
  };
}

describe('Gpt4oDialogueAdapter', () => {
  it('routes through gateway.callExternalAI("gpt4o_dialogue", ...) and injects the system prompt', async () => {
    const gateway = fakeGateway(() => ({ text: '많이 힘드셨겠어요. 어떤 점이 가장 무겁게 느껴지셨나요?' }));
    const adapter = new Gpt4oDialogueAdapter({ gateway, retryDelayMs: 0 });

    const out = await adapter.generate(baseInput());

    expect(gateway.calls).toHaveLength(1);
    const call = gateway.calls[0];
    expect(call).toBeDefined();
    expect(call?.userText).toBe('오늘 너무 지치고 힘들었어요.');
    expect(call?.systemPrompt).toContain('[금지 행위]');
    expect(call?.systemPrompt).toContain('비의료');
    expect(call?.systemPrompt).toContain('감정탐색');
    expect(out.aiResponse).toContain('어떤 점이');
  });

  it('activates the medical redirect branch in the prompt when detected', async () => {
    const gateway = fakeGateway(() => ({ text: '전문 상담 기관의 도움을 받아보시는 건 어떨까요?' }));
    const adapter = new Gpt4oDialogueAdapter({ gateway, retryDelayMs: 0 });

    await adapter.generate(
      baseInput({
        medicalDetection: {
          isMedicalRedirect: true,
          matchedCategories: ['diagnosis'],
          matchedKeywords: ['우울증'],
        },
      }),
    );

    const call = gateway.calls[0];
    expect(call?.systemPrompt).toContain('[의료 키워드 감지 분기 — 활성]');
    expect(call?.systemPrompt).toContain('전문 정신건강 상담 기관');
  });

  it('preserves recent exchanges in the injected prompt', async () => {
    const gateway = fakeGateway(() => ({ text: '그랬군요. 조금 더 말씀해 주실 수 있을까요?' }));
    const adapter = new Gpt4oDialogueAdapter({ gateway, retryDelayMs: 0 });

    await adapter.generate(
      baseInput({
        recentExchanges: [
          { role: 'user', text: '회사에서 실수를 했어요', timestamp: new Date('2026-05-28T00:00:01.000Z') },
          { role: 'ai', text: '많이 속상하셨겠어요', timestamp: new Date('2026-05-28T00:00:02.000Z') },
        ],
      }),
    );

    const call = gateway.calls[0];
    expect(call?.systemPrompt).toContain('회사에서 실수를 했어요');
    expect(call?.systemPrompt).toContain('많이 속상하셨겠어요');
  });

  it('accepts raw response field and wrapped { response } payloads', async () => {
    const wrapped = fakeGateway(() => ({ response: { text: '래핑된 응답' } }));
    const adapterWrapped = new Gpt4oDialogueAdapter({ gateway: wrapped, retryDelayMs: 0 });
    expect((await adapterWrapped.generate(baseInput())).aiResponse).toBe('래핑된 응답');

    const rawOnly = fakeGateway(() => ({ raw: '  raw 텍스트 응답  ' }));
    const adapterRaw = new Gpt4oDialogueAdapter({ gateway: rawOnly, retryDelayMs: 0 });
    expect((await adapterRaw.generate(baseInput())).aiResponse).toBe('raw 텍스트 응답');
  });

  it('retries on transient error then returns eventual success', async () => {
    const gateway = fakeGateway((attempt) => {
      if (attempt < 2) {
        throw new Error('transient failure');
      }
      return { text: '결국 성공한 응답' };
    });
    const adapter = new Gpt4oDialogueAdapter({ gateway, retryDelayMs: 0 });
    const out = await adapter.generate(baseInput());
    expect(gateway.calls).toHaveLength(2);
    expect(out.aiResponse).toBe('결국 성공한 응답');
  });

  it('retries on empty responses', async () => {
    const gateway = fakeGateway((attempt) => {
      if (attempt < 3) {
        return { text: '   ' };
      }
      return { text: '비지 않은 응답' };
    });
    const adapter = new Gpt4oDialogueAdapter({ gateway, retryDelayMs: 0 });
    const out = await adapter.generate(baseInput());
    expect(gateway.calls).toHaveLength(3);
    expect(out.aiResponse).toBe('비지 않은 응답');
  });

  it('throws DialogueExhaustedError after 3 failed attempts', async () => {
    const gateway = fakeGateway(() => {
      throw new Error('persistent failure');
    });
    const adapter = new Gpt4oDialogueAdapter({ gateway, retryDelayMs: 0 });
    await expect(adapter.generate(baseInput())).rejects.toBeInstanceOf(
      DialogueExhaustedError,
    );
    expect(gateway.calls).toHaveLength(3);
  });

  it('aborts a single call after perAttemptTimeoutMs and treats it as a failure', async () => {
    let abortedOnce = false;
    const gateway: DialogueAIGateway & { calls: number } = {
      calls: 0,
      async callExternalAI(
        _target: 'gpt4o_dialogue',
        req: DialogueGatewayRequest,
      ): Promise<DialogueGatewayResponse> {
        this.calls += 1;
        if (this.calls === 1) {
          return await new Promise((_resolve, reject) => {
            req.signal?.addEventListener('abort', () => {
              abortedOnce = true;
              reject(new Error('aborted'));
            });
          });
        }
        return { text: '두 번째 시도 성공' };
      },
    };
    const adapter = new Gpt4oDialogueAdapter({
      gateway,
      retryDelayMs: 0,
      perAttemptTimeoutMs: 20,
    });
    const out = await adapter.generate(baseInput());
    expect(abortedOnce).toBe(true);
    expect(gateway.calls).toBeGreaterThanOrEqual(2);
    expect(out.aiResponse).toBe('두 번째 시도 성공');
  });
});
