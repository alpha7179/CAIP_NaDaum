// AIGatewayImpl 단위 테스트
import { describe, expect, it, vi } from 'vitest';

import { PassthroughHook } from '../../adapters/ai-gateway/PassthroughHook.js';

import {
  AIGatewayImpl,
  ExternalAIBlockedError,
  type AIGatewayAuditLogger,
  type ExternalAdapter,
  type ExternalAIRequest,
  type ProcessedExternalAIRequest,
} from './AIGateway.js';
import type {
  DeidentificationHook,
  HookContext,
  HookProcessInput,
  HookProcessResult,
} from './DeidentificationHook.js';

const baseContext: HookContext = {
  userId: 'user-123',
  sessionId: 'session-456',
  callTarget: 'gpt4o_dialogue',
};

interface FakeRequest extends ExternalAIRequest {
  readonly text: string;
}

function makeRecordingAdapter(response: unknown = { ok: true }): {
  adapter: ExternalAdapter<FakeRequest, unknown>;
  invokeCount: () => number;
  lastProcessed: () => ProcessedExternalAIRequest<FakeRequest> | undefined;
} {
  let count = 0;
  let last: ProcessedExternalAIRequest<FakeRequest> | undefined;
  const adapter: ExternalAdapter<FakeRequest, unknown> = {
    async invoke(processed) {
      count += 1;
      last = processed;
      return response;
    },
  };
  return {
    adapter,
    invokeCount: () => count,
    lastProcessed: () => last,
  };
}

describe('AIGatewayImpl', () => {
  it('routes to the registered adapter and returns response with meta', async () => {
    const gw = new AIGatewayImpl(new PassthroughHook());
    const { adapter, invokeCount, lastProcessed } = makeRecordingAdapter({ reply: '안녕하세요' });
    gw.registerAdapter<FakeRequest, { reply: string }>('gpt4o_dialogue', adapter as ExternalAdapter<FakeRequest, { reply: string }>);

    const result = await gw.callExternalAI<FakeRequest, { reply: string }>(
      'gpt4o_dialogue',
      { text: '오늘 기분이 별로야' },
      baseContext,
    );

    expect(invokeCount()).toBe(1);
    expect(result.response).toEqual({ reply: '안녕하세요' });
    expect(result.meta.target).toBe('gpt4o_dialogue');
    expect(result.meta.hookId).toBe('passthrough');
    expect(result.meta.maskedTokenCount).toBe(0);
    expect(result.meta.piiCategories).toEqual([]);
    expect(result.meta.latencyMs.hook).toBeGreaterThanOrEqual(0);
    expect(result.meta.latencyMs.adapter).toBeGreaterThanOrEqual(0);
    expect(result.meta.latencyMs.total).toBeGreaterThanOrEqual(0);

    const processed = lastProcessed();
    expect(processed?.text).toBe('오늘 기분이 별로야');
    expect(processed?.context.callTarget).toBe('gpt4o_dialogue');
    expect(processed?.hookResult.masked).toBe(false);
  });

  it('applies the hook exactly once per call', async () => {
    const processSpy = vi.fn(async (input: HookProcessInput): Promise<HookProcessResult> => ({
      text: input.text,
      masked: false,
      detectedPiiCategories: [],
      tokenMappings: [],
      meta: { latencyMs: 0 },
    }));
    const hook: DeidentificationHook = { hookId: 'spy', process: processSpy };
    const gw = new AIGatewayImpl(hook);
    const { adapter, invokeCount } = makeRecordingAdapter();
    gw.registerAdapter('gpt4o_emotion', adapter);

    await gw.callExternalAI('gpt4o_emotion', { text: 'a' }, { ...baseContext, callTarget: 'gpt4o_emotion' });
    await gw.callExternalAI('gpt4o_emotion', { text: 'b' }, { ...baseContext, callTarget: 'gpt4o_emotion' });
    await gw.callExternalAI('gpt4o_emotion', { text: 'c' }, { ...baseContext, callTarget: 'gpt4o_emotion' });

    expect(processSpy).toHaveBeenCalledTimes(3);
    expect(invokeCount()).toBe(3);

    const stats = gw.getCallStats();
    expect(stats.callCount).toBe(3);
    expect(stats.hookApplyCount).toBe(3);
    expect(stats.externalInvokeCount).toBe(3);
  });

  it('counters: callCount === hookApplyCount === externalInvokeCount on success', async () => {
    const gw = new AIGatewayImpl(new PassthroughHook());
    const { adapter } = makeRecordingAdapter();
    gw.registerAdapter('gpt4o_emotion', adapter);
    gw.registerAdapter('gpt4o_dialogue', adapter);

    await gw.callExternalAI('gpt4o_emotion', { text: '' }, { ...baseContext, callTarget: 'gpt4o_emotion' });
    await gw.callExternalAI('gpt4o_dialogue', { text: 'hi' }, baseContext);

    const stats = gw.getCallStats();
    expect(stats.callCount).toBe(2);
    expect(stats.hookApplyCount).toBe(2);
    expect(stats.externalInvokeCount).toBe(2);
  });

  it('blocks external call and records audit log when hook throws', async () => {
    const failingHook: DeidentificationHook = {
      hookId: 'failing',
      async process() {
        throw new Error('hook boom');
      },
    };
    const audit: AIGatewayAuditLogger = {
      logHookFailure: vi.fn(),
    };
    const gw = new AIGatewayImpl(failingHook, audit);
    const { adapter, invokeCount } = makeRecordingAdapter();
    gw.registerAdapter('gpt4o_dialogue', adapter);

    await expect(
      gw.callExternalAI('gpt4o_dialogue', { text: 'hi' }, baseContext),
    ).rejects.toBeInstanceOf(ExternalAIBlockedError);

    expect(invokeCount()).toBe(0);
    expect(audit.logHookFailure).toHaveBeenCalledTimes(1);

    const stats = gw.getCallStats();
    expect(stats.callCount).toBe(1);
    expect(stats.hookApplyCount).toBe(0);
    expect(stats.externalInvokeCount).toBe(0);
  });

  it('does not propagate audit logger errors to the caller', async () => {
    const failingHook: DeidentificationHook = {
      hookId: 'failing',
      async process() {
        throw new Error('hook boom');
      },
    };
    const audit: AIGatewayAuditLogger = {
      logHookFailure: () => {
        throw new Error('audit logger broken');
      },
    };
    const gw = new AIGatewayImpl(failingHook, audit);
    const { adapter } = makeRecordingAdapter();
    gw.registerAdapter('gpt4o_dialogue', adapter);

    await expect(
      gw.callExternalAI('gpt4o_dialogue', { text: 'hi' }, baseContext),
    ).rejects.toBeInstanceOf(ExternalAIBlockedError);
  });

  it('supports setHook swap toggle', async () => {
    const hookA: DeidentificationHook = {
      hookId: 'A',
      async process(i) {
        return {
          text: i.text,
          masked: false,
          detectedPiiCategories: [],
          tokenMappings: [],
          meta: { latencyMs: 0 },
        };
      },
    };
    const hookB: DeidentificationHook = {
      hookId: 'B',
      async process(i) {
        return {
          text: `[B]${i.text}`,
          masked: true,
          detectedPiiCategories: ['name'],
          tokenMappings: [{ tokenId: 't1', original: 'X', replacement: '[NAME_1]' }],
          meta: { latencyMs: 0 },
        };
      },
    };

    const gw = new AIGatewayImpl(hookA);
    const { adapter, lastProcessed } = makeRecordingAdapter();
    gw.registerAdapter('gpt4o_dialogue', adapter);

    expect(gw.getHookId()).toBe('A');
    const r1 = await gw.callExternalAI('gpt4o_dialogue', { text: 'hello' }, baseContext);
    expect(lastProcessed()?.text).toBe('hello');
    expect(r1.meta.hookId).toBe('A');
    expect(r1.meta.maskedTokenCount).toBe(0);

    gw.setHook(hookB);
    expect(gw.getHookId()).toBe('B');
    const r2 = await gw.callExternalAI('gpt4o_dialogue', { text: 'hello' }, baseContext);
    expect(lastProcessed()?.text).toBe('[B]hello');
    expect(r2.meta.hookId).toBe('B');
    expect(r2.meta.maskedTokenCount).toBe(1);
    expect(r2.meta.piiCategories).toEqual(['name']);
  });

  it('throws a clear error when no adapter is registered for the target', async () => {
    const gw = new AIGatewayImpl(new PassthroughHook());
    await expect(
      gw.callExternalAI('gpt4o_diary', { text: 'x' }, { ...baseContext, callTarget: 'gpt4o_diary' }),
    ).rejects.toThrow(/No adapter registered/);
  });

  it('normalizes context.callTarget to match the call argument', async () => {
    const gw = new AIGatewayImpl(new PassthroughHook());
    const { adapter, lastProcessed } = makeRecordingAdapter();
    gw.registerAdapter('gpt4o_emotion', adapter);

    await gw.callExternalAI(
      'gpt4o_emotion',
      { text: 'x' },
      { ...baseContext, callTarget: 'gpt4o_dialogue' },
    );

    expect(lastProcessed()?.context.callTarget).toBe('gpt4o_emotion');
  });

  it('handles requests without a text field by passing empty string to the hook', async () => {
    const processSpy = vi.fn(async (input: HookProcessInput): Promise<HookProcessResult> => ({
      text: input.text,
      masked: false,
      detectedPiiCategories: [],
      tokenMappings: [],
      meta: { latencyMs: 0 },
    }));
    const hook: DeidentificationHook = { hookId: 'spy', process: processSpy };
    const gw = new AIGatewayImpl(hook);
    const { adapter, lastProcessed } = makeRecordingAdapter();
    gw.registerAdapter('gpt4o_emotion', adapter);

    await gw.callExternalAI(
      'gpt4o_emotion',
      { audioBase64: 'AAA=' } as unknown as FakeRequest,
      { ...baseContext, callTarget: 'gpt4o_emotion' },
    );

    expect(processSpy).toHaveBeenCalledTimes(1);
    const callArg = processSpy.mock.calls[0]?.[0];
    expect(callArg?.text).toBe('');
    expect((lastProcessed()?.raw as { audioBase64?: string }).audioBase64).toBe('AAA=');
  });

  it('resetCallStats zeroes the counters', async () => {
    const gw = new AIGatewayImpl(new PassthroughHook());
    const { adapter } = makeRecordingAdapter();
    gw.registerAdapter('gpt4o_dialogue', adapter);
    await gw.callExternalAI('gpt4o_dialogue', { text: 'x' }, baseContext);
    expect(gw.getCallStats().callCount).toBe(1);

    gw.resetCallStats();
    expect(gw.getCallStats()).toEqual({
      callCount: 0,
      hookApplyCount: 0,
      externalInvokeCount: 0,
    });
  });
});
