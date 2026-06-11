// StageTransition 단위 테스트

import { CONVERSATION_STAGES } from '@nadaum/shared';
import { describe, expect, it } from 'vitest';


import { getNextStage } from './StageTransition.js';

describe('getNextStage', () => {
  it('endIntent=true 시 어떤 단계에서도 부드러운마무리로 전환한다', () => {
    for (const stage of CONVERSATION_STAGES) {
      expect(getNextStage(stage, false, true)).toBe('부드러운마무리');
      expect(getNextStage(stage, true, true)).toBe('부드러운마무리');
    }
  });

  it('현재 단계에서 교환이 없었다면 단계를 유지한다', () => {
    expect(getNextStage('상황파악', false, false)).toBe('상황파악');
    expect(getNextStage('감정탐색', false, false)).toBe('감정탐색');
    expect(getNextStage('생각탐색', false, false)).toBe('생각탐색');
    expect(getNextStage('패턴연결', false, false)).toBe('패턴연결');
  });

  it('교환이 있으면 다음 단계로 전진한다', () => {
    expect(getNextStage('상황파악', true, false)).toBe('감정탐색');
    expect(getNextStage('감정탐색', true, false)).toBe('생각탐색');
    expect(getNextStage('생각탐색', true, false)).toBe('패턴연결');
    expect(getNextStage('패턴연결', true, false)).toBe('부드러운마무리');
  });

  it('부드러운마무리 단계에서는 더 이상 전진하지 않는다', () => {
    expect(getNextStage('부드러운마무리', true, false)).toBe('부드러운마무리');
    expect(getNextStage('부드러운마무리', false, false)).toBe('부드러운마무리');
    expect(getNextStage('부드러운마무리', true, true)).toBe('부드러운마무리');
  });
});
