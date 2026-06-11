// Express 앱 골격 및 사용자 대면 REST 엔드포인트

import express, { type Application, type NextFunction, type Request, type Response } from 'express';
import passport from 'passport';

import { ProtectedAdminError } from '../adapters/auth/adminProtection.js';
import type { NotionConnectionRepository } from '../adapters/notion/NotionConnectionRepository.js';
import type { DiarySummarizerPort } from '../adapters/summary/DiarySummarizer.js';
import { AuthValidationError } from '../domain/auth/types.js';
import type { DiaryQueryService } from '../domain/query/DiaryQueryService.js';
import type { EndReason, UtteranceInput } from '../domain/session/SessionOrchestrator.js';

import { getUserId, getIsAdmin, requireAuth, requireAdmin } from './middleware/auth.js';
import { setupNotionRoutes } from './notion.js';
import { buildOpenApiSpec } from './openapi/spec.js';
import type { AdminApi, AuthApi, AvailableModel, SessionApi } from './ports.js';
import { getMentalHealthResources } from './resources.js';
import { setupGoogleOAuth } from './security/googleOAuth.js';


export interface AppDeps {
  readonly jwtSecret: string;
  readonly auth: AuthApi;
  readonly session: SessionApi;
  readonly diaries: DiaryQueryService;
  readonly summarizer?: DiarySummarizerPort;
  readonly corsOrigin?: string;
  readonly availableModels?: ReadonlyArray<AvailableModel>;
  readonly admin?: AdminApi;
  readonly googleOAuth?: {
    readonly clientId: string;
    readonly clientSecret: string;
    readonly backendUrl: string;
    readonly frontendUrl: string;
  } | undefined;
  readonly notion?: {
    readonly repo: NotionConnectionRepository;
  } | undefined;
}

const VALID_END_REASONS: ReadonlySet<EndReason> = new Set<EndReason>([
  'user',
  'silence',
  'high_risk',
  'error',
]);

function wrap(
  handler: (req: Request, res: Response) => Promise<void>,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    handler(req, res).catch(next);
  };
}

export function createApp(deps: AppDeps): Application {
  const app = express();
  app.use(express.json({ limit: '8mb' }));
  app.use(cors(deps.corsOrigin ?? '*'));
  app.use(passport.initialize());

  const auth = requireAuth(deps.jwtSecret);

  if (deps.googleOAuth !== undefined) {
    setupGoogleOAuth(app as unknown as import('express').Router, {
      ...deps.googleOAuth,
      auth: deps.auth,
    });
  }

  if (deps.notion !== undefined) {
    setupNotionRoutes(app as unknown as import('express').Router, {
      ...deps.notion,
      jwtSecret: deps.jwtSecret,
      diaries: deps.diaries,
    });
  }

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });
  app.get('/openapi.json', (_req, res) => {
    res.json(buildOpenApiSpec());
  });

  app.get('/resources/mental-health', (_req, res) => {
    res.json(getMentalHealthResources());
  });

  app.get('/models', (_req, res) => {
    res.json({ models: deps.availableModels ?? [] });
  });

  app.post(
    '/auth/register',
    wrap(async (req, res) => {
      const result = await deps.auth.register(req.body);
      res.status(201).json(result);
    }),
  );

  app.get(
    '/auth/check-email',
    wrap(async (req, res) => {
      const email = typeof req.query.email === 'string' ? req.query.email.trim() : '';
      if (email.length === 0 || !email.includes('@')) {
        res.status(400).json({ error: '유효한 이메일을 입력해 주세요.', code: 'invalid_email' });
        return;
      }
      const available = await deps.auth.isEmailAvailable(email);
      res.json({ available });
    }),
  );

  app.post(
    '/auth/login',
    wrap(async (req, res) => {
      const result = await deps.auth.login(req.body);
      if (result === undefined) {
        res.status(401).json({ error: 'invalid credentials', code: 'unauthorized' });
        return;
      }
      res.json(result);
    }),
  );

  app.post(
    '/auth/withdraw-consent',
    auth,
    wrap(async (req, res) => {
      const items = Array.isArray(req.body?.items) ? (req.body.items as string[]) : [];
      await deps.auth.withdrawConsent(getUserId(req), items);
      res.status(204).end();
    }),
  );

  app.post(
    '/auth/change-password',
    auth,
    wrap(async (req, res) => {
      const current = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
      const next    = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';
      if (next.length < 6) {
        res.status(400).json({ error: '새 비밀번호는 6자 이상이어야 합니다.', code: 'invalid_password' });
        return;
      }
      const ok = await deps.auth.changePassword(getUserId(req), current, next);
      if (!ok) {
        res.status(400).json({ error: '현재 비밀번호가 일치하지 않습니다.', code: 'wrong_password' });
        return;
      }
      res.status(204).end();
    }),
  );

  app.delete(
    '/auth/account',
    auth,
    wrap(async (req, res) => {
      await deps.auth.deleteAccount(getUserId(req));
      res.status(204).end();
    }),
  );

  app.get(
    '/me/notification-preferences',
    auth,
    wrap(async (req, res) => {
      const prefs = await deps.auth.getNotificationPreferences(getUserId(req));
      res.json(prefs);
    }),
  );

  app.patch(
    '/me/notification-preferences',
    auth,
    wrap(async (req, res) => {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const prefs: { emailEnabled?: boolean; smsEnabled?: boolean } = {};
      if (typeof body.emailEnabled === 'boolean') prefs.emailEnabled = body.emailEnabled;
      if (typeof body.smsEnabled === 'boolean') prefs.smsEnabled = body.smsEnabled;
      await deps.auth.setNotificationPreferences(getUserId(req), prefs);
      const updated = await deps.auth.getNotificationPreferences(getUserId(req));
      res.json(updated);
    }),
  );

  app.get(
    '/me/guardians',
    auth,
    wrap(async (req, res) => {
      const guardians = await deps.auth.getGuardians(getUserId(req));
      res.json({ guardians });
    }),
  );

  app.put(
    '/me/guardians',
    auth,
    wrap(async (req, res) => {
      const rawList = Array.isArray((req.body as { guardians?: unknown })?.guardians)
        ? ((req.body as { guardians: unknown[] }).guardians)
        : [];
      const guardians = rawList.map((item) => {
        const g = (item ?? {}) as Record<string, unknown>;
        const rel = typeof g.relationship === 'string' ? g.relationship.trim() : '';
        return {
          ...(rel.length > 0 ? { relationship: rel } : {}),
          name: typeof g.name === 'string' ? g.name : '',
          email: typeof g.email === 'string' ? g.email : '',
          phone: typeof g.phone === 'string' ? g.phone : '',
          emailEnabled: g.emailEnabled !== false,
          smsEnabled: g.smsEnabled !== false,
        };
      });
      await deps.auth.setGuardians(getUserId(req), guardians);
      const saved = await deps.auth.getGuardians(getUserId(req));
      res.json({ guardians: saved });
    }),
  );

  app.post(
    '/sessions',
    auth,
    wrap(async (req, res) => {
      const model = typeof req.body?.model === 'string' && req.body.model.length > 0
        ? req.body.model
        : undefined;
      const result = await deps.session.start(getUserId(req), model, getIsAdmin(req));
      res.status(201).json(result);
    }),
  );

  app.post(
    '/sessions/:id/utterances',
    auth,
    wrap(async (req, res) => {
      const userId = getUserId(req);
      const sessionId = String(req.params.id);
      const input = parseUtteranceInput(req.body);
      if (input.ok === false) {
        res.status(400).json({ error: input.reason, code: 'invalid_input' });
        return;
      }
      const result = await deps.session.handleUtterance(userId, sessionId, input.value);
      if (result.ok === false) {
        const status = result.reason === 'session_not_found' ? 404 : 400;
        res.status(status).json({ error: result.reason, code: result.reason });
        return;
      }
      res.json(result);
    }),
  );

  app.post(
    '/sessions/:id/end',
    auth,
    wrap(async (req, res) => {
      const reasonRaw = typeof req.body?.reason === 'string' ? req.body.reason : 'user';
      const reason: EndReason = VALID_END_REASONS.has(reasonRaw as EndReason)
        ? (reasonRaw as EndReason)
        : 'user';
      const result = await deps.session.end(getUserId(req), String(req.params.id), reason);
      res.json(result);
    }),
  );

  app.get(
    '/diaries',
    auth,
    wrap(async (req, res) => {
      const page = Number.parseInt(String(req.query.page ?? '0'), 10);
      const result = await deps.diaries.list(getUserId(req), Number.isFinite(page) ? page : 0);
      res.json(result);
    }),
  );

  app.get(
    '/diaries/trend',
    auth,
    wrap(async (req, res) => {
      const limit = Number.parseInt(String(req.query.limit ?? '7'), 10);
      const result = await deps.diaries.getRecentTrend(
        getUserId(req),
        Number.isFinite(limit) ? limit : 7,
      );
      res.json(result);
    }),
  );

  app.get(
    '/diaries/:id',
    auth,
    wrap(async (req, res) => {
      const diary = await deps.diaries.getById(getUserId(req), String(req.params.id));
      if (diary === undefined) {
        res.status(404).json({ error: 'diary not found', code: 'not_found' });
        return;
      }
      res.json(diary);
    }),
  );

  app.post(
    '/diaries/:id/summary',
    auth,
    wrap(async (req, res) => {
      if (deps.summarizer === undefined) {
        res.status(404).json({ error: 'summary not available', code: 'not_available' });
        return;
      }
      const diary = await deps.diaries.getById(getUserId(req), String(req.params.id));
      if (diary === undefined) {
        res.status(404).json({ error: 'diary not found', code: 'not_found' });
        return;
      }
      const rawLines = Number.parseInt(String(req.body?.lines ?? '3'), 10);
      const lines = Number.isFinite(rawLines) ? rawLines : 3;
      const summary = await deps.summarizer.summarize(diary.body, lines);
      res.json({ summary });
    }),
  );

  app.patch(
    '/diaries/:id',
    auth,
    wrap(async (req, res) => {
      const body = typeof req.body?.body === 'string' ? req.body.body : '';
      if (body.trim().length === 0) {
        res.status(400).json({ error: '본문은 비울 수 없습니다.', code: 'invalid_body' });
        return;
      }
      const updated = await deps.diaries.updateBody(getUserId(req), String(req.params.id), body);
      if (updated === undefined) {
        res.status(404).json({ error: 'diary not found', code: 'not_found' });
        return;
      }
      res.json(updated);
    }),
  );

  app.delete(
    '/diaries/:id',
    auth,
    wrap(async (req, res) => {
      const ok = await deps.diaries.deleteById(getUserId(req), String(req.params.id));
      if (!ok) {
        res.status(404).json({ error: 'diary not found', code: 'not_found' });
        return;
      }
      res.status(204).end();
    }),
  );

  if (deps.admin !== undefined) {
    const admin = deps.admin;
    const adminAuth = requireAdmin(deps.jwtSecret);

    app.get(
      '/admin/users',
      adminAuth,
      wrap(async (_req, res) => {
        const users = await admin.listUsers();
        res.json({ users });
      }),
    );

    app.delete(
      '/admin/users/:id',
      adminAuth,
      wrap(async (req, res) => {
        await admin.deleteUser(String(req.params.id));
        res.status(204).end();
      }),
    );

    app.patch(
      '/admin/users/:id/admin',
      adminAuth,
      wrap(async (req, res) => {
        const targetId = String(req.params.id);
        const isAdmin = req.body?.isAdmin === true;
        if (!isAdmin && targetId === getUserId(req)) {
          res.status(400).json({
            error: '자기 자신의 관리자 권한은 회수할 수 없습니다.',
            code: 'self_demotion_forbidden',
          });
          return;
        }
        await admin.setAdmin(targetId, isAdmin);
        res.status(204).end();
      }),
    );

    app.get(
      '/admin/users/:id/diaries',
      adminAuth,
      wrap(async (req, res) => {
        const page = Number.parseInt(String(req.query.page ?? '0'), 10);
        const result = await admin.getUserDiaries(
          String(req.params.id),
          Number.isFinite(page) ? page : 0,
        );
        res.json(result);
      }),
    );

    app.patch(
      '/admin/users/:id/model',
      adminAuth,
      wrap(async (req, res) => {
        const raw = req.body?.modelId;
        const modelId = typeof raw === 'string' && raw.length > 0 ? raw : undefined;
        const available = deps.availableModels ?? [];
        if (modelId !== undefined && !available.some((m) => m.id === modelId)) {
          res.status(400).json({ error: '알 수 없는 모델입니다.', code: 'unknown_model' });
          return;
        }
        await admin.setUserModel(String(req.params.id), modelId);
        res.status(204).end();
      }),
    );
  }

  app.use(errorHandler);

  return app;
}

function cors(origin: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  };
}

function parseUtteranceInput(
  body: unknown,
): { ok: true; value: UtteranceInput } | { ok: false; reason: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  if (typeof b.text === 'string' && b.text.trim().length > 0) {
    return { ok: true, value: { text: b.text } };
  }
  return { ok: false, reason: 'missing_text' };
}

function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AuthValidationError) {
    res.status(400).json({ error: err.message, code: err.code });
    return;
  }
  if (err instanceof ProtectedAdminError) {
    res.status(403).json({ error: err.message, code: err.code });
    return;
  }
  const message = err instanceof Error ? err.message : 'internal error';
  res.status(500).json({ error: message, code: 'internal_error' });
}
