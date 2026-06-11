// 속성 테스트: 세션 메모리 경계
import type { Exchange } from '@nadaum/shared';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';


import {
  MAX_EXCHANGES,
  addExchange,
  createInitialSessionContext,
} from './SessionContext.js';

const exchangeArb: fc.Arbitrary<Exchange> = fc.record({
  role: fc.constantFrom<'user' | 'ai'>('user', 'ai'),
  text: fc.string(),
  timestamp: fc
    .integer({ min: 0, max: 1_000_000 })
    .map((ms) => new Date(1_700_000_000_000 + ms)),
});

describe('세션 메모리 경계', () => {
  it('never exceeds MAX_EXCHANGES and preserves FIFO order', () => {
    fc.assert(
      fc.property(fc.array(exchangeArb, { maxLength: 200 }), (exchanges) => {
        let context = createInitialSessionContext({
          sessionId: 'pbt',
          userId: 'user',
          startedAt: new Date('2026-05-28T00:00:00.000Z'),
        });
        for (const ex of exchanges) {
          context = addExchange(context, ex);
        }
        expect(context.exchanges.length).toBe(Math.min(exchanges.length, MAX_EXCHANGES));
        expect(context.exchanges.length).toBeLessThanOrEqual(MAX_EXCHANGES);

        const expectedTail = exchanges.slice(-MAX_EXCHANGES);
        expect(context.exchanges.map((e) => e.text)).toEqual(
          expectedTail.map((e) => e.text),
        );
      }),
    );
  });

  it('updates lastUtteranceAt only on user exchanges', () => {
    fc.assert(
      fc.property(exchangeArb, (ex) => {
        const base = createInitialSessionContext({
          sessionId: 'pbt',
          userId: 'user',
          startedAt: new Date('2026-05-28T00:00:00.000Z'),
        });
        const next = addExchange(base, ex);
        if (ex.role === 'user') {
          expect(next.lastUtteranceAt.getTime()).toBe(ex.timestamp.getTime());
        } else {
          expect(next.lastUtteranceAt.getTime()).toBe(base.lastUtteranceAt.getTime());
        }
      }),
    );
  });
});
