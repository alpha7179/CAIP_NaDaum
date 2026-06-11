// detectRecallTrigger 단위 테스트
import { describe, expect, it } from 'vitest';

import { detectRecallTrigger } from './recallTrigger.js';

describe('detectRecallTrigger', () => {
  it('일반 발화는 트리거되지 않는다', () => {
    const r = detectRecallTrigger('오늘 기분이 좀 가라앉아요.');
    expect(r.triggered).toBe(false);
    expect(r.cues).toEqual([]);
  });

  it('"어제" 같은 시간 참조 단서를 감지한다', () => {
    const r = detectRecallTrigger('어제 발표 얘기했잖아요, 그게 계속 떠올라요.');
    expect(r.triggered).toBe(true);
    expect(r.cues).toContain('어제');
  });

  it('"지난주 월요일" 형태의 요일 표현을 감지한다', () => {
    const r = detectRecallTrigger('지난주 월요일에 어땠지?');
    expect(r.triggered).toBe(true);
    expect(r.cues.some((c) => c.includes('월요일'))).toBe(true);
  });

  it('"3일 전" 같은 상대 숫자 표현을 감지한다', () => {
    const r = detectRecallTrigger('3일 전쯤 그 일 얘기했어요.');
    expect(r.triggered).toBe(true);
    expect(r.cues.some((c) => c.includes('3'))).toBe(true);
  });

  it('회상 동사("얘기했") 단독으로도 트리거된다', () => {
    const r = detectRecallTrigger('전에 그 일을 얘기했었던 것 같아요.');
    expect(r.triggered).toBe(true);
    expect(r.cues).toContain('얘기했');
  });

  it('빈 문자열은 트리거되지 않는다', () => {
    const r = detectRecallTrigger('');
    expect(r.triggered).toBe(false);
  });

  it('동일 입력에 대해 결과가 결정적이다', () => {
    const text = '저번에 했던 그 얘기, 어제 다시 떠올랐어요.';
    const a = detectRecallTrigger(text);
    const b = detectRecallTrigger(text);
    expect(a).toEqual(b);
  });
});
