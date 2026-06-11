// JWT 서명·검증 단위 테스트
import { describe, expect, it } from 'vitest';

import { JwtError, signJwt, verifyJwt } from './jwt.js';

const secret = 'test-secret';

describe('jwt', () => {
  it('signs and verifies a token, exposing sub', () => {
    const token = signJwt({ sub: 'user-1' }, secret);
    expect(verifyJwt(token, secret).sub).toBe('user-1');
  });

  it('rejects a tampered signature', () => {
    const token = signJwt({ sub: 'user-1' }, secret);
    const tampered = `${token}x`;
    expect(() => verifyJwt(tampered, secret)).toThrow(JwtError);
  });

  it('rejects a token signed with another secret', () => {
    const token = signJwt({ sub: 'user-1' }, 'other');
    expect(() => verifyJwt(token, secret)).toThrow(JwtError);
  });

  it('rejects an expired token', () => {
    const token = signJwt({ sub: 'user-1' }, secret, { expiresInSec: 60, now: () => 1000 });
    expect(() => verifyJwt(token, secret, { now: () => 2000 })).toThrow(/expired/);
  });

  it('accepts a non-expired token within window', () => {
    const token = signJwt({ sub: 'user-1' }, secret, { expiresInSec: 60, now: () => 1000 });
    expect(verifyJwt(token, secret, { now: () => 1030 }).sub).toBe('user-1');
  });

  it('rejects alg confusion (non-HS256 header)', () => {
    const forgedHeader = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' }))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    const forgedPayload = Buffer.from(JSON.stringify({ sub: 'user-1' }))
      .toString('base64')
      .replace(/=+$/, '');
    expect(() => verifyJwt(`${forgedHeader}.${forgedPayload}.`, secret)).toThrow(JwtError);
  });
});
