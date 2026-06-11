// TextChannel 단위 테스트
import { describe, expect, it } from 'vitest';

import type { ChannelAnalyzeContext } from '../../domain/emotion/EmotionChannel.js';

import {
  TextChannel,
  TextChannelExhaustedError,
  buildEmotionPrompt,
  type EmotionAIGateway,
  type EmotionGatewayRequest,
  type EmotionGatewayResponse,
} from './TextChannel.js';

const baseContext: ChannelAnalyzeContext = {
  sessionId: 'session-abc',
  userId: 'user-xyz',
};

function fakeGateway(
  responder: (
    attempt: number,
    req: EmotionGatewayRequest,
  ) => Promise<EmotionGatewayResponse> | EmotionGatewayResponse,
): EmotionAIGateway & { calls: EmotionGatewayRequest[] } {
  const calls: EmotionGatewayRequest[] = [];
  return {
    calls,
    async callExternalAI(
      _target: 'gpt4o_emotion',
      req: EmotionGatewayRequest,
    ): Promise<EmotionGatewayResponse> {
      calls.push(req);
      return await responder(calls.length, req);
    },
  };
}

const validParsedBody = {
  scores: {
    기쁨: 2,
    슬픔: 8,
    분노: 6,
    불안: 9,
    놀람: 3,
    혐오: 4,
    중립: 5,
  },
  distortions: ['파국화', '감정적추론'],
  confidence: 0.78,
};

describe('TextChannel', () => {
  describe('buildEmotionPrompt', () => {
    it('includes all 7 emotion categories and 4 distortions in the prompt', () => {
      const prompt = buildEmotionPrompt('오늘 너무 힘들었어');
      for (const cat of ['기쁨', '슬픔', '분노', '불안', '놀람', '혐오', '중립']) {
        expect(prompt).toContain(cat);
      }
      for (const dist of ['흑백논리', '과잉일반화', '파국화', '감정적추론']) {
        expect(prompt).toContain(dist);
      }
      expect(prompt).toContain('JSON');
    });

    it('embeds the user utterance verbatim', () => {
      const text = '회사가 정말 지긋지긋해';
      expect(buildEmotionPrompt(text)).toContain(text);
    });
  });

  it('exposes channelId="text" and isAvailable=true', async () => {
    const gateway = fakeGateway(() => ({ parsed: validParsedBody }));
    const channel = new TextChannel({ gateway });
    expect(channel.channelId).toBe('text');
    expect(await channel.isAvailable()).toBe(true);
  });

  it('routes calls through gateway.callExternalAI("gpt4o_emotion", ...)', async () => {
    const gateway = fakeGateway(() => ({ parsed: validParsedBody }));
    const channel = new TextChannel({ gateway, retryDelayMs: 0 });
    await channel.analyze({ text: '오늘 정말 슬펐다.' }, baseContext);
    expect(gateway.calls).toHaveLength(1);
    const call = gateway.calls[0];
    expect(call).toBeDefined();
    expect(call?.prompt).toContain('오늘 정말 슬펐다.');
    expect(call?.schema.emotions).toContain('슬픔');
    expect(call?.schema.distortions).toContain('파국화');
  });

  it('returns clamped/rounded scores within 1-10', async () => {
    const gateway = fakeGateway(() => ({
      parsed: {
        scores: {
          기쁨: -3,
          슬픔: 11,
          분노: 6.7,
          불안: 9.4,
          놀람: 0,
          혐오: Number.NaN,
          중립: 'oops',
        },
        distortions: [],
        confidence: 1,
      },
    }));
    const channel = new TextChannel({ gateway, retryDelayMs: 0 });
    const result = await channel.analyze({ text: 'hi' }, baseContext);
    expect(result.scores.기쁨).toBe(1);
    expect(result.scores.슬픔).toBe(10);
    expect(result.scores.분노).toBe(7);
    expect(result.scores.불안).toBe(9);
    expect(result.scores.놀람).toBe(1);
    expect(result.scores.혐오).toBe(5);
    expect(result.scores.중립).toBe(5);
    for (const v of Object.values(result.scores)) {
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(10);
    }
  });

  it('discards unknown cognitive distortions and dedupes known ones', async () => {
    const gateway = fakeGateway(() => ({
      parsed: {
        scores: validParsedBody.scores,
        distortions: ['파국화', '낯선왜곡', '파국화', 42, '흑백논리'],
        confidence: 0.5,
      },
    }));
    const channel = new TextChannel({ gateway, retryDelayMs: 0 });
    const result = await channel.analyze({ text: 'x' }, baseContext);
    expect(result.distortions).toEqual(
      expect.arrayContaining(['파국화', '흑백논리']),
    );
    expect(result.distortions).not.toContain('낯선왜곡');
    expect(result.distortions?.length).toBe(2);
  });

  it('parses raw JSON string responses when parsed is absent', async () => {
    const gateway = fakeGateway(() => ({
      raw: JSON.stringify(validParsedBody),
    }));
    const channel = new TextChannel({ gateway, retryDelayMs: 0 });
    const result = await channel.analyze({ text: 'hello' }, baseContext);
    expect(result.scores.불안).toBe(9);
    expect(result.distortions).toEqual(
      expect.arrayContaining(['파국화', '감정적추론']),
    );
  });

  it('retries on transient gateway error and returns the eventual success', async () => {
    const gateway = fakeGateway((attempt) => {
      if (attempt < 2) {
        throw new Error('transient network failure');
      }
      return { parsed: validParsedBody };
    });
    const channel = new TextChannel({ gateway, retryDelayMs: 0 });
    const result = await channel.analyze({ text: 'retry me' }, baseContext);
    expect(gateway.calls).toHaveLength(2);
    expect(result.confidence).toBeCloseTo(0.78);
  });

  it('retries on malformed JSON responses then succeeds', async () => {
    const gateway = fakeGateway((attempt) => {
      if (attempt < 3) {
        return { raw: 'not-json-at-all' };
      }
      return { parsed: validParsedBody };
    });
    const channel = new TextChannel({ gateway, retryDelayMs: 0 });
    const result = await channel.analyze({ text: 'malformed' }, baseContext);
    expect(gateway.calls).toHaveLength(3);
    expect(result.scores.기쁨).toBe(2);
  });

  it('throws TextChannelExhaustedError after 3 failed attempts', async () => {
    const gateway = fakeGateway(() => {
      throw new Error('persistent failure');
    });
    const channel = new TextChannel({ gateway, retryDelayMs: 0 });
    await expect(
      channel.analyze({ text: 'always fails' }, baseContext),
    ).rejects.toBeInstanceOf(TextChannelExhaustedError);
    expect(gateway.calls).toHaveLength(3);
  });

  it('aborts a single call after perAttemptTimeoutMs and treats it as a failure', async () => {
    let abortedOnce = false;
    const gateway: EmotionAIGateway & { calls: number } = {
      calls: 0,
      async callExternalAI(
        _target: 'gpt4o_emotion',
        req: EmotionGatewayRequest,
      ): Promise<EmotionGatewayResponse> {
        this.calls += 1;
        if (this.calls === 1) {
          return await new Promise((resolve, reject) => {
            req.signal?.addEventListener('abort', () => {
              abortedOnce = true;
              reject(new Error('aborted'));
            });
          });
        }
        return { parsed: validParsedBody };
      },
    };
    const channel = new TextChannel({
      gateway,
      retryDelayMs: 0,
      perAttemptTimeoutMs: 20,
    });
    const result = await channel.analyze({ text: 'slow' }, baseContext);
    expect(abortedOnce).toBe(true);
    expect(gateway.calls).toBeGreaterThanOrEqual(2);
    expect(result.scores.불안).toBe(9);
  });

  it('does not call the gateway for empty input and returns neutral defaults', async () => {
    const gateway = fakeGateway(() => ({ parsed: validParsedBody }));
    const channel = new TextChannel({ gateway, retryDelayMs: 0 });
    const result = await channel.analyze({ text: '   ' }, baseContext);
    expect(gateway.calls).toHaveLength(0);
    for (const v of Object.values(result.scores)) {
      expect(v).toBe(5);
    }
    expect(result.distortions).toEqual([]);
    expect(result.confidence).toBe(0);
  });

  it('attaches modelVersion and finite latencyMs to result meta', async () => {
    const gateway = fakeGateway(() => ({ parsed: validParsedBody }));
    const channel = new TextChannel({
      gateway,
      modelVersion: 'gpt-4o-2024-08-06',
      retryDelayMs: 0,
    });
    const result = await channel.analyze({ text: 'meta check' }, baseContext);
    expect(result.meta.modelVersion).toBe('gpt-4o-2024-08-06');
    expect(Number.isFinite(result.meta.latencyMs)).toBe(true);
    expect(result.meta.latencyMs).toBeGreaterThanOrEqual(0);
  });
});
