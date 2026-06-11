// Redis 세션 키·직렬화 헬퍼 단위 테스트.

import { describe, expect, it } from 'vitest';

import {
  SESSION_KEY_PREFIX,
  SESSION_TTL_SECONDS,
  deserializeJson,
  serializeJson,
  sessionKey,
} from './redis.js';

describe('sessionKey', () => {
  it('생성된 키는 "session:" prefix 뒤에 sessionId가 붙은 형태여야 한다', () => {
    const id = 'abc123';
    expect(sessionKey(id)).toBe(`${SESSION_KEY_PREFIX}${id}`);
    expect(sessionKey(id)).toBe('session:abc123');
  });

  it('UUID 형태 sessionId도 그대로 키 형태로 변환한다', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000';
    expect(sessionKey(uuid)).toBe(`session:${uuid}`);
  });

  it('빈 문자열 sessionId는 거부한다', () => {
    expect(() => sessionKey('')).toThrow(/non-empty/);
  });

  it('sessionId에 콜론이 포함되면 네임스페이스 침범으로 거부한다', () => {
    expect(() => sessionKey('foo:bar')).toThrow(/":"/);
    expect(() => sessionKey(':')).toThrow(/":"/);
  });
});

describe('SESSION_TTL_SECONDS', () => {
  it('TTL은 정확히 1시간(3600초)이어야 한다', () => {
    expect(SESSION_TTL_SECONDS).toBe(3600);
  });
});

describe('serializeJson / deserializeJson', () => {
  it('기본 객체에 대해 직렬화·역직렬화는 라운드트립이 항등이어야 한다', () => {
    const original = {
      sessionId: 's-1',
      stage: '상황파악' as const,
      exchanges: [
        { role: 'user', text: '안녕', timestamp: '2025-01-01T00:00:00.000Z' },
        { role: 'ai', text: '반가워요', timestamp: '2025-01-01T00:00:01.000Z' },
      ],
      cumulativeEmotion: { 기쁨: 5, 슬픔: 2, 분노: 1, 불안: 3, 놀람: 1, 혐오: 1, 중립: 4 },
    };
    const serialized = serializeJson(original);
    expect(typeof serialized).toBe('string');
    expect(deserializeJson(serialized)).toEqual(original);
  });

  it('한국어 문자열을 손실 없이 보존한다', () => {
    const text = '오늘 정말 힘든 하루였어요. 😢';
    expect(deserializeJson<string>(serializeJson(text))).toBe(text);
  });

  it('빈 객체/배열/null도 라운드트립을 보장한다', () => {
    expect(deserializeJson(serializeJson({}))).toEqual({});
    expect(deserializeJson(serializeJson([]))).toEqual([]);
    expect(deserializeJson(serializeJson(null))).toBeNull();
  });

  it('잘못된 JSON 입력은 SyntaxError를 그대로 전파한다', () => {
    expect(() => deserializeJson('{not json')).toThrow(SyntaxError);
  });
});
