// 3-인자 AIGateway를 도메인 어댑터의 2-인자 게이트웨이 포트로 변환

import type { AIGateway, ExternalAITarget } from '../../domain/ai-gateway/AIGateway.js';
import type { ExternalAIRequest } from '../../domain/ai-gateway/AIGateway.js';
import type { HookContext } from '../../domain/ai-gateway/DeidentificationHook.js';

// 2-인자 게이트웨이 포트 (도메인 어댑터 최소 형태)
export interface BoundGateway {
  callExternalAI(target: ExternalAITarget, req: ExternalAIRequest): Promise<unknown>;
}

export function createBoundGateway(
  gateway: AIGateway,
  baseContext: Omit<HookContext, 'callTarget'>,
): BoundGateway {
  return {
    async callExternalAI(target: ExternalAITarget, req: ExternalAIRequest): Promise<unknown> {
      const result = await gateway.callExternalAI(target, req, {
        ...baseContext,
        callTarget: target,
      });
      return result.response;
    },
  };
}
