// 스모크 테스트 — Vitest + fast-check 의존성 통합 확인.

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

describe('toolchain smoke test', () => {
  it('Vitest is wired up', () => {
    expect(1 + 1).toBe(2);
  });

  it('fast-check property runs against integers', () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer(), (a, b) => a + b === b + a),
      { numRuns: 50 },
    );
  });
});
