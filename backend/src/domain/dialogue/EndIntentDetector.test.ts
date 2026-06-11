// EndIntentDetector 단위 테스트

import { describe, expect, it } from 'vitest';

import { detectEndIntent } from './EndIntentDetector.js';

describe('detectEndIntent', () => {
  it('빈 입력 또는 공백만 포함된 입력은 false를 반환한다', () => {
    expect(detectEndIntent('')).toBe(false);
    expect(detectEndIntent('   ')).toBe(false);
  });

  it('명시적 종료 표현을 감지한다', () => {
    expect(detectEndIntent('이제 그만할게')).toBe(true);
    expect(detectEndIntent('오늘은 여기서 끝낼게요')).toBe(true);
    expect(detectEndIntent('대화 마칠게')).toBe(true);
    expect(detectEndIntent('나갈게요')).toBe(true);
    expect(detectEndIntent('종료')).toBe(true);
  });

  it('종료 의사가 없는 발화에 대해 false를 반환한다', () => {
    expect(detectEndIntent('오늘 좀 힘들었어')).toBe(false);
    expect(detectEndIntent('계속 이야기하고 싶어')).toBe(false);
    expect(detectEndIntent('그냥 무기력해')).toBe(false);
  });

  it('공백 정규화 후에도 동일하게 매칭한다', () => {
    expect(detectEndIntent('  이제   그만   ')).toBe(true);
  });
});
