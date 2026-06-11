// SessionEventHub 단위 테스트
import { describe, expect, it } from 'vitest';

import { SessionEventHub } from './SessionEventHub.js';

describe('SessionEventHub', () => {
  it('delivers events to subscribers of the same session', () => {
    const hub = new SessionEventHub();
    const received: string[] = [];
    hub.subscribe('s1', (e) => received.push(`${e.type}:${String(e.payload)}`));
    hub.publish('s1', 'stt', 'hello');
    hub.publish('s1', 'ai_response', 'hi');
    expect(received).toEqual(['stt:hello', 'ai_response:hi']);
  });

  it('isolates events between sessions', () => {
    const hub = new SessionEventHub();
    const s1: unknown[] = [];
    hub.subscribe('s1', (e) => s1.push(e.payload));
    hub.publish('s2', 'stt', 'other');
    expect(s1).toHaveLength(0);
  });

  it('stops delivery after unsubscribe and tracks subscriber count', () => {
    const hub = new SessionEventHub();
    const got: unknown[] = [];
    const off = hub.subscribe('s1', (e) => got.push(e.payload));
    expect(hub.subscriberCount('s1')).toBe(1);
    off();
    expect(hub.subscriberCount('s1')).toBe(0);
    hub.publish('s1', 'stt', 'x');
    expect(got).toHaveLength(0);
  });

  it('absorbs a failing listener without blocking others', () => {
    const hub = new SessionEventHub();
    const got: unknown[] = [];
    hub.subscribe('s1', () => {
      throw new Error('boom');
    });
    hub.subscribe('s1', (e) => got.push(e.payload));
    hub.publish('s1', 'risk', '고위험');
    expect(got).toEqual(['고위험']);
  });
});
