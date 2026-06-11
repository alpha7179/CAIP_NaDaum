// 노션 연동 라우트 — 사용자별 "내부 통합 토큰" 연결 + 일기 내보내기

import type { Request, Response, Router } from 'express';

import {
  getBotInfo,
  findFirstAccessiblePage,
  getPageById,
  parsePageId,
  createPage,
  NotionApiError,
} from '../adapters/notion/NotionClient.js';
import type { NotionConnectionRepository } from '../adapters/notion/NotionConnectionRepository.js';
import { diaryToNotionPage } from '../adapters/notion/diaryToBlocks.js';
import type { DiaryQueryService } from '../domain/query/DiaryQueryService.js';

import { requireAuth, getUserId } from './middleware/auth.js';

export interface NotionRoutesConfig {
  readonly jwtSecret: string;
  readonly repo: NotionConnectionRepository;
  readonly diaries: DiaryQueryService;
}

export function setupNotionRoutes(router: Router, cfg: NotionRoutesConfig): void {
  const auth = requireAuth(cfg.jwtSecret);

  router.post('/integrations/notion/verify-token', auth, (req: Request, res: Response) => {
    void (async () => {
      const token = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
      if (token.length === 0) {
        res.status(400).json({ error: '노션 통합 토큰을 입력해 주세요.', code: 'missing_token' });
        return;
      }
      try {
        const info = await getBotInfo(token);
        res.json({ valid: true, ...(info.workspaceName ? { workspaceName: info.workspaceName } : {}) });
      } catch (err) {
        if (err instanceof NotionApiError && err.status === 401) {
          res.status(400).json({ error: '토큰이 올바르지 않습니다. 다시 확인해 주세요.', code: 'invalid_token' });
          return;
        }
        const msg = err instanceof Error ? err.message : '토큰 검증에 실패했어요.';
        res.status(502).json({ error: msg, code: 'notion_verify_failed' });
      }
    })();
  });

  router.post('/integrations/notion/connect', auth, (req: Request, res: Response) => {
    void (async () => {
      const userId = getUserId(req);
      const token = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
      if (token.length === 0) {
        res.status(400).json({ error: '노션 통합 토큰을 입력해 주세요.', code: 'missing_token' });
        return;
      }
      const pageUrl = typeof req.body?.pageUrl === 'string' ? req.body.pageUrl.trim() : '';
      try {
        const info = await getBotInfo(token);
        let target: { pageId: string; title: string } | undefined;
        if (pageUrl.length > 0) {
          const pageId = parsePageId(pageUrl);
          if (pageId === undefined) {
            res.status(400).json({
              error: '노션 페이지 링크 형식이 올바르지 않아요. 페이지의 공유 링크를 붙여넣어 주세요.',
              code: 'invalid_page_url',
            });
            return;
          }
          target = await getPageById(token, pageId);
        } else {
          target = await findFirstAccessiblePage(token);
        }
        await cfg.repo.upsert({
          userId,
          accessToken: token,
          ...(info.workspaceName ? { workspaceName: info.workspaceName } : {}),
          ...(target ? { targetPageId: target.pageId, targetPageTitle: target.title } : {}),
        });
        res.json({
          connected: true,
          ...(info.workspaceName ? { workspaceName: info.workspaceName } : {}),
          ...(target ? { targetPageTitle: target.title } : {}),
          hasTarget: target !== undefined,
        });
      } catch (err) {
        if (err instanceof NotionApiError && err.status === 401) {
          res.status(400).json({ error: '토큰이 올바르지 않습니다. 다시 확인해 주세요.', code: 'invalid_token' });
          return;
        }
        if (err instanceof NotionApiError && (err.status === 404 || err.status === 403) && pageUrl.length > 0) {
          res.status(400).json({
            error: '그 페이지에 접근할 수 없어요. 노션에서 해당 페이지를 통합에 공유(··· → 연결)한 뒤 다시 시도해 주세요.',
            code: 'notion_page_not_accessible',
          });
          return;
        }
        console.error('[notion] connect 실패:', err);
        const msg = err instanceof Error ? err.message : '노션 연결에 실패했어요.';
        res.status(502).json({ error: msg, code: 'notion_connect_failed' });
      }
    })();
  });

  router.patch('/integrations/notion/target', auth, (req: Request, res: Response) => {
    void (async () => {
      const userId = getUserId(req);
      const conn = await cfg.repo.get(userId);
      if (conn === undefined) {
        res.status(409).json({ error: '노션이 연결되어 있지 않습니다.', code: 'notion_not_connected' });
        return;
      }
      const pageUrl = typeof req.body?.pageUrl === 'string' ? req.body.pageUrl.trim() : '';
      try {
        let target: { pageId: string; title: string } | undefined;
        if (pageUrl.length > 0) {
          const pageId = parsePageId(pageUrl);
          if (pageId === undefined) {
            res.status(400).json({ error: '노션 페이지 링크 형식이 올바르지 않아요. 페이지의 공유 링크를 붙여넣어 주세요.', code: 'invalid_page_url' });
            return;
          }
          target = await getPageById(conn.accessToken, pageId);
        } else {
          target = await findFirstAccessiblePage(conn.accessToken);
        }
        await cfg.repo.upsert({
          userId,
          accessToken: conn.accessToken,
          ...(conn.workspaceName ? { workspaceName: conn.workspaceName } : {}),
          ...(target ? { targetPageId: target.pageId, targetPageTitle: target.title } : {}),
        });
        res.json({
          connected: true,
          ...(conn.workspaceName ? { workspaceName: conn.workspaceName } : {}),
          ...(target ? { targetPageTitle: target.title } : {}),
          hasTarget: target !== undefined,
        });
      } catch (err) {
        if (err instanceof NotionApiError && err.status === 401) {
          await cfg.repo.delete(userId);
          res.status(409).json({ error: '노션 연결이 만료되었습니다. 다시 연결해 주세요.', code: 'notion_reauth_required' });
          return;
        }
        if (err instanceof NotionApiError && (err.status === 404 || err.status === 403) && pageUrl.length > 0) {
          res.status(400).json({
            error: '그 페이지에 접근할 수 없어요. 노션에서 해당 페이지를 통합에 공유(··· → 연결)한 뒤 다시 시도해 주세요.',
            code: 'notion_page_not_accessible',
          });
          return;
        }
        const msg = err instanceof Error ? err.message : '저장 페이지 변경에 실패했어요.';
        res.status(502).json({ error: msg, code: 'notion_target_update_failed' });
      }
    })();
  });

  router.get('/integrations/notion/status', auth, (req: Request, res: Response) => {
    void (async () => {
      const conn = await cfg.repo.get(getUserId(req));
      if (conn === undefined) {
        res.json({ connected: false });
        return;
      }
      res.json({
        connected: true,
        ...(conn.workspaceName ? { workspaceName: conn.workspaceName } : {}),
        ...(conn.targetPageTitle ? { targetPageTitle: conn.targetPageTitle } : {}),
        hasTarget: conn.targetPageId !== undefined,
      });
    })();
  });

  router.delete('/integrations/notion', auth, (req: Request, res: Response) => {
    void (async () => {
      await cfg.repo.delete(getUserId(req));
      res.status(204).end();
    })();
  });

  router.post('/diaries/:id/export/notion', auth, (req: Request, res: Response) => {
    void (async () => {
      const userId = getUserId(req);
      const conn = await cfg.repo.get(userId);
      if (conn === undefined) {
        res.status(409).json({ error: '노션이 연결되어 있지 않습니다.', code: 'notion_not_connected' });
        return;
      }
      if (conn.targetPageId === undefined) {
        res.status(409).json({
          error: '노션에서 접근 가능한 페이지가 없습니다. 통합에 페이지를 하나 이상 공유한 뒤 다시 연결해 주세요.',
          code: 'notion_no_target',
        });
        return;
      }
      const diary = await cfg.diaries.getById(userId, String(req.params.id));
      if (diary === undefined) {
        res.status(404).json({ error: 'diary not found', code: 'not_found' });
        return;
      }
      const { title, children } = diaryToNotionPage(diary);
      try {
        const page = await createPage(conn.accessToken, conn.targetPageId, title, children);
        res.json({ url: page.url, pageId: page.id });
      } catch (err) {
        if (err instanceof NotionApiError && err.status === 401) {
          await cfg.repo.delete(userId);
          res.status(409).json({ error: '노션 연결이 만료되었습니다. 다시 연결해 주세요.', code: 'notion_reauth_required' });
          return;
        }
        const msg = err instanceof Error ? err.message : '노션 페이지 생성에 실패했어요.';
        res.status(502).json({ error: msg, code: 'notion_export_failed' });
      }
    })();
  });
}
