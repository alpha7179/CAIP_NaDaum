// WebSocket / SSE 실시간 채널

import type { Server } from 'node:http';

import type { Application, Request, Response } from 'express';
import { WebSocketServer, type WebSocket } from 'ws';

import { verifyJwt } from '../security/jwt.js';

import type { SessionEvent, SessionEventHub } from './SessionEventHub.js';

export interface RealtimeDeps {
  readonly jwtSecret: string;
  readonly hub: SessionEventHub;
}

const WS_PATH_RE = /^\/ws\/session\/([^/?]+)/;

function tokenFromUrl(url: string | undefined): string | undefined {
  if (url === undefined) {
    return undefined;
  }
  const q = url.indexOf('?');
  if (q < 0) {
    return undefined;
  }
  const params = new URLSearchParams(url.slice(q + 1));
  return params.get('token') ?? undefined;
}

export function attachWebSocket(server: Server, deps: RealtimeDeps): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    const match = WS_PATH_RE.exec(req.url ?? '');
    if (match === null) {
      socket.destroy();
      return;
    }
    const sessionId = decodeURIComponent(match[1] as string);
    const token = tokenFromUrl(req.url);
    if (token === undefined) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }
    try {
      verifyJwt(token, deps.jwtSecret);
    } catch {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      bindSocketToSession(ws, sessionId, deps.hub);
    });
  });

  return wss;
}

function bindSocketToSession(
  ws: WebSocket,
  sessionId: string,
  hub: SessionEventHub,
): void {
  const unsubscribe = hub.subscribe(sessionId, (event: SessionEvent) => {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(event));
    }
  });
  ws.on('close', unsubscribe);
  ws.on('error', unsubscribe);
}

export function registerSse(app: Application, deps: RealtimeDeps): void {
  app.get('/sse/session/:sessionId', (req: Request, res: Response) => {
    const token =
      bearerFromHeader(req.header('authorization') ?? req.header('Authorization')) ??
      (typeof req.query.token === 'string' ? req.query.token : undefined);
    if (token === undefined) {
      res.status(401).json({ error: 'missing token', code: 'unauthorized' });
      return;
    }
    try {
      verifyJwt(token, deps.jwtSecret);
    } catch {
      res.status(401).json({ error: 'invalid token', code: 'unauthorized' });
      return;
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.write(': connected\n\n');

    const sessionId = String(req.params.sessionId);
    const unsubscribe = deps.hub.subscribe(sessionId, (event) => {
      res.write(`event: ${event.type}\n`);
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    });
    req.on('close', unsubscribe);
  });
}

function bearerFromHeader(header: string | undefined): string | undefined {
  if (header === undefined || !header.startsWith('Bearer ')) {
    return undefined;
  }
  return header.slice('Bearer '.length).trim();
}
