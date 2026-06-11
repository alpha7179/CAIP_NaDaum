// 최소 JWT(HS256) 서명·검증 유틸

import { createHmac, timingSafeEqual } from 'node:crypto';

// JWT 페이로드(표준 클레임)
export interface JwtPayload {
  readonly sub: string;
  readonly iat?: number;
  readonly exp?: number;
  readonly [claim: string]: unknown;
}

function base64UrlEncode(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64UrlDecode(input: string): Buffer {
  const pad = input.length % 4 === 0 ? '' : '='.repeat(4 - (input.length % 4));
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/') + pad;
  return Buffer.from(normalized, 'base64');
}

function sign(data: string, secret: string): string {
  return base64UrlEncode(createHmac('sha256', secret).update(data).digest());
}

// JWT 검증 실패 예외
export class JwtError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'JwtError';
  }
}

export function signJwt(
  payload: JwtPayload,
  secret: string,
  opts: { expiresInSec?: number; now?: () => number } = {},
): string {
  const nowSec = opts.now ? opts.now() : Math.floor(Date.now() / 1000);
  const fullPayload: JwtPayload = {
    iat: nowSec,
    ...(opts.expiresInSec !== undefined ? { exp: nowSec + opts.expiresInSec } : {}),
    ...payload,
  };
  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = sign(signingInput, secret);
  return `${signingInput}.${signature}`;
}

export function verifyJwt(
  token: string,
  secret: string,
  opts: { now?: () => number } = {},
): JwtPayload {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new JwtError('malformed token');
  }
  const [encodedHeader, encodedPayload, signature] = parts as [string, string, string];

  let header: { alg?: unknown };
  try {
    header = JSON.parse(base64UrlDecode(encodedHeader).toString('utf8')) as { alg?: unknown };
  } catch {
    throw new JwtError('malformed header');
  }
  if (header.alg !== 'HS256') {
    throw new JwtError(`unsupported alg: ${String(header.alg)}`);
  }

  const expected = sign(`${encodedHeader}.${encodedPayload}`, secret);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new JwtError('invalid signature');
  }

  let payload: JwtPayload;
  try {
    payload = JSON.parse(base64UrlDecode(encodedPayload).toString('utf8')) as JwtPayload;
  } catch {
    throw new JwtError('malformed payload');
  }

  const nowSec = opts.now ? opts.now() : Math.floor(Date.now() / 1000);
  if (typeof payload.exp === 'number' && nowSec >= payload.exp) {
    throw new JwtError('token expired');
  }
  if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
    throw new JwtError('missing sub claim');
  }
  return payload;
}
