// 속성 테스트: 5단계 흐름 단조성
import { CONVERSATION_STAGES, type ConversationStage } from '@nadaum/shared';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';


import { getNextStage } from './StageTransition.js';

const stageArb = fc.constantFrom<ConversationStage>(...CONVERSATION_STAGES);
const stepArb = fc.record({ hadExchange: fc.boolean(), endIntent: fc.boolean() });

function index(stage: ConversationStage): number {
  return CONVERSATION_STAGES.indexOf(stage);
}

describe('5단계 흐름 단조성', () => {
  it('never regresses the stage index in a single step', () => {
    fc.assert(
      fc.property(stageArb, stepArb, (current, step) => {
        const next = getNextStage(current, step.hadExchange, step.endIntent);
        expect(index(next)).toBeGreaterThanOrEqual(index(current));
      }),
    );
  });

  it('advances by at most one stage when not ending', () => {
    fc.assert(
      fc.property(stageArb, fc.boolean(), (current, hadExchange) => {
        const next = getNextStage(current, hadExchange, false);
        expect(index(next) - index(current)).toBeLessThanOrEqual(1);
      }),
    );
  });

  it('always transitions to 부드러운마무리 when end intent is detected', () => {
    fc.assert(
      fc.property(stageArb, fc.boolean(), (current, hadExchange) => {
        expect(getNextStage(current, hadExchange, true)).toBe('부드러운마무리');
      }),
    );
  });

  it('folded over an arbitrary sequence stays monotonic non-decreasing', () => {
    fc.assert(
      fc.property(fc.array(stepArb, { maxLength: 30 }), (steps) => {
        let current: ConversationStage = '상황파악';
        for (const step of steps) {
          const next = getNextStage(current, step.hadExchange, step.endIntent);
          expect(index(next)).toBeGreaterThanOrEqual(index(current));
          current = next;
        }
      }),
    );
  });
});
