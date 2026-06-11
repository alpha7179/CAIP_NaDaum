// GatewayDiaryEmbedder 단위 테스트
import { describe, expect, it } from 'vitest';

import {
  GatewayDiaryEmbedder,
  type EmbeddingAIGateway,
} from './GatewayDiaryEmbedder.js';

function fakeGateway(impl: (text: string) => unknown): EmbeddingAIGateway & { calls: number; lastText: string } {
  const state = {
    calls: 0,
    lastText: '',
    async callExternalAI(_target: 'embedding', req: { text: string }): Promise<unknown> {
      state.calls += 1;
      state.lastText = req.text;
      return impl(req.text);
    },
  };
  return state;
}

describe('GatewayDiaryEmbedder', () => {
  it('직접 페이로드 형태({ vector })를 그대로 받는다', async () => {
    const gw = fakeGateway(() => ({ vector: [0.1, 0.2, 0.3] }));
    const embedder = new GatewayDiaryEmbedder({ gateway: gw });
    const v = await embedder.embed('어제 그 얘기 떠올라요');
    expect(v).toEqual([0.1, 0.2, 0.3]);
    expect(gw.calls).toBe(1);
    expect(gw.lastText).toBe('어제 그 얘기 떠올라요');
  });

  it('메타 래핑 형태({ response: { vector } })도 정규화한다', async () => {
    const gw = fakeGateway(() => ({ response: { vector: [1, 2, 3] }, meta: { latencyMs: 0 } }));
    const embedder = new GatewayDiaryEmbedder({ gateway: gw });
    const v = await embedder.embed('hello');
    expect(v).toEqual([1, 2, 3]);
  });

  it('빈/공백 입력은 외부 호출 없이 빈 벡터를 반환한다', async () => {
    const gw = fakeGateway(() => ({ vector: [9] }));
    const embedder = new GatewayDiaryEmbedder({ gateway: gw });
    const v = await embedder.embed('   ');
    expect(v).toEqual([]);
    expect(gw.calls).toBe(0);
  });

  it('알 수 없는 응답 형태는 빈 벡터로 보수적 폴백한다', async () => {
    const gw = fakeGateway(() => ({ unexpected: true }));
    const embedder = new GatewayDiaryEmbedder({ gateway: gw });
    const v = await embedder.embed('text');
    expect(v).toEqual([]);
  });

  it('입력 텍스트의 양끝 공백은 트림되어 게이트웨이로 전달된다', async () => {
    const gw = fakeGateway(() => ({ vector: [0] }));
    const embedder = new GatewayDiaryEmbedder({ gateway: gw });
    await embedder.embed('   안녕   ');
    expect(gw.lastText).toBe('안녕');
  });
});
