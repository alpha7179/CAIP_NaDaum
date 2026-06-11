// resolveDateReference 단위 테스트
import { describe, expect, it } from 'vitest';

import { resolveDateReference } from './dateReference.js';

const TODAY = '2026-06-11';

describe('resolveDateReference', () => {
  it('"어제"는 기준일 -1일을 단일 범위로 반환한다', () => {
    const ref = resolveDateReference('어제 그 얘기 다시 떠올라요', TODAY);
    expect(ref).toBeDefined();
    expect(ref!.range).toEqual({ from: '2026-06-10', to: '2026-06-10' });
    expect(ref!.matched).toBe('어제');
  });

  it('"그제/그저께"는 기준일 -2일을 반환한다', () => {
    const a = resolveDateReference('그제 일을 떠올렸어요', TODAY);
    const b = resolveDateReference('그저께 그 얘기', TODAY);
    expect(a!.range).toEqual({ from: '2026-06-09', to: '2026-06-09' });
    expect(b!.range).toEqual({ from: '2026-06-09', to: '2026-06-09' });
  });

  it('"3일 전"은 기준일 -3일을 반환한다', () => {
    const ref = resolveDateReference('3일 전 일이 떠올라요', TODAY);
    expect(ref!.range).toEqual({ from: '2026-06-08', to: '2026-06-08' });
  });

  it('"2주 전"은 기준일 -14일을 반환한다', () => {
    const ref = resolveDateReference('2주 전쯤이었던 것 같아요', TODAY);
    expect(ref!.range).toEqual({ from: '2026-05-28', to: '2026-05-28' });
  });

  it('"지난주 월요일"은 직전 주 월요일을 반환한다', () => {
    const ref = resolveDateReference('지난주 월요일에 어땠지?', TODAY);
    expect(ref!.range).toEqual({ from: '2026-06-01', to: '2026-06-01' });
  });

  it('"지난주"(요일 없음)는 직전 주 7일 범위를 반환한다', () => {
    const ref = resolveDateReference('지난주에 있었던 일', TODAY);
    expect(ref!.range).toEqual({ from: '2026-06-01', to: '2026-06-07' });
  });

  it('"며칠 전" 같은 모호한 표현은 undefined를 반환한다(의미 검색 위임)', () => {
    expect(resolveDateReference('며칠 전 일이에요', TODAY)).toBeUndefined();
    expect(resolveDateReference('얼마 전쯤이었어요', TODAY)).toBeUndefined();
  });

  it('날짜 표현이 전혀 없으면 undefined를 반환한다', () => {
    expect(resolveDateReference('오늘 기분이 가라앉아요', TODAY)?.matched).toBe('오늘');
    expect(resolveDateReference('아무 표현 없는 평범한 발화', TODAY)).toBeUndefined();
  });
});
