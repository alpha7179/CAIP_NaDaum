// PassthroughHook 단위 테스트
import { describe, expect, it } from 'vitest';

import type { HookContext } from '../../domain/ai-gateway/DeidentificationHook.js';

import { PassthroughHook, defaultPassthroughHook } from './PassthroughHook.js';

const baseContext: HookContext = {
  userId: 'user-123',
  sessionId: 'session-456',
  callTarget: 'gpt4o_dialogue',
};

describe('PassthroughHook', () => {
  it('exposes the canonical hook identifier', () => {
    const hook = new PassthroughHook();
    expect(hook.hookId).toBe('passthrough');
  });

  it('returns the input text unchanged', async () => {
    const hook = new PassthroughHook();
    const text = '오늘 기분이 정말 별로야.';
    const result = await hook.process({ text, context: baseContext });
    expect(result.text).toBe(text);
  });

  it('reports masked=false and empty PII metadata', async () => {
    const hook = new PassthroughHook();
    const result = await hook.process({
      text: '이름은 홍길동이고 전화번호는 010-1234-5678 입니다.',
      context: baseContext,
    });
    expect(result.masked).toBe(false);
    expect(result.detectedPiiCategories).toEqual([]);
    expect(result.tokenMappings).toEqual([]);
  });

  it('measures a non-negative finite latency', async () => {
    const hook = new PassthroughHook();
    const result = await hook.process({ text: 'hello', context: baseContext });
    expect(Number.isFinite(result.meta.latencyMs)).toBe(true);
    expect(result.meta.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('preserves result metadata signature across all ExternalAITarget values', async () => {
    const hook = new PassthroughHook();
    const targets: HookContext['callTarget'][] = [
      'gpt4o_emotion',
      'gpt4o_dialogue',
      'gpt4o_diary',
      'hume_prosody',
      'elevenlabs_tts',
    ];
    for (const callTarget of targets) {
      const result = await hook.process({
        text: 'sample',
        context: { userId: 'u', callTarget },
      });
      expect(result).toMatchObject({
        text: 'sample',
        masked: false,
        detectedPiiCategories: [],
        tokenMappings: [],
        meta: { latencyMs: expect.any(Number) as number },
      });
    }
  });

  it('handles empty text input without throwing', async () => {
    const hook = new PassthroughHook();
    const result = await hook.process({ text: '', context: baseContext });
    expect(result.text).toBe('');
    expect(result.masked).toBe(false);
  });

  it('exposes a shared default instance implementing the interface', async () => {
    expect(defaultPassthroughHook.hookId).toBe('passthrough');
    const result = await defaultPassthroughHook.process({
      text: 'shared',
      context: baseContext,
    });
    expect(result.text).toBe('shared');
  });
});
