// 토큰 인증 미들웨어

import type { NextFunction, Request, Response } from 'express';

import { JwtError, verifyJwt } from '../security/jwt.js';

export interface AuthedRequest extends Request {
  userId?: string;
  isAdmin?: boolean;
}

export function getUserId(req: Request): string {
  const userId = (req as AuthedRequest).userId;
  if (typeof userId !== 'string' || userId.length === 0) {
    throw new Error('getUserId: request is not authenticated');
  }
  return userId;
}

export function getIsAdmin(req: Request): boolean {
  return (req as AuthedRequest).isAdmin === true;
}

export function requireAuth(secret: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const header = req.header('authorization') ?? req.header('Authorization');
    if (header === undefined || !header.startsWith('Bearer ')) {
      res.status(401).json({ error: 'missing bearer token', code: 'unauthorized' });
      return;
    }
    const token = header.slice('Bearer '.length).trim();
    try {
      const payload = verifyJwt(token, secret);
      (req as AuthedRequest).userId = payload.sub;
      (req as AuthedRequest).isAdmin = payload.admin === true;
      next();
    } catch (err) {
      const message = err instanceof JwtError ? err.message : 'invalid token';
      res.status(401).json({ error: message, code: 'unauthorized' });
    }
  };
}

export function requireAdmin(secret: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const header = req.header('authorization') ?? req.header('Authorization');
    if (header === undefined || !header.startsWith('Bearer ')) {
      res.status(401).json({ error: 'missing bearer token', code: 'unauthorized' });
      return;
    }
    const token = header.slice('Bearer '.length).trim();
    try {
      const payload = verifyJwt(token, secret);
      if (payload.admin !== true) {
        res.status(403).json({ error: '관리자 권한이 필요합니다.', code: 'forbidden' });
        return;
      }
      (req as AuthedRequest).userId = payload.sub;
      (req as AuthedRequest).isAdmin = true;
      next();
    } catch (err) {
      const message = err instanceof JwtError ? err.message : 'invalid token';
      res.status(401).json({ error: message, code: 'unauthorized' });
    }
  };
}
