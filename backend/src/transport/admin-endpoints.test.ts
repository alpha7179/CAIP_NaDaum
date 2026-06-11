// 관리자 사용자 관리 엔드포인트 통합 테스트
import http from 'node:http';
import type { AddressInfo } from 'node:net';

import type { DiaryEntry } from '@nadaum/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';


import { InMemoryDiaryRepository } from '../adapters/persistence/DiaryRepository.js';
import { DiaryQueryService } from '../domain/query/DiaryQueryService.js';
import type { HandleUtteranceResult, UtteranceInput } from '../domain/session/SessionOrchestrator.js';

import { createApp } from './app.js';
import type { AdminApi, AuthApi, SessionApi, UserSummary } from './ports.js';
import { signJwt } from './security/jwt.js';

const SECRET = 'admin-test-secret';
const ADMIN_ID = 'admin-1';
const USER_ID = 'user-2';

const adminToken = signJwt({ sub: ADMIN_ID, admin: true }, SECRET);
const userToken = signJwt({ sub: USER_ID }, SECRET);

const fakeAuth: AuthApi = {
  async register() {
    return { userId: USER_ID, token: userToken };
  },
  async isEmailAvailable() {
    return true;
  },
  async login() {
    return undefined;
  },
  async withdrawConsent() {},
};

const fakeSession: SessionApi = {
  async start() {
    return { sessionId: 's1', stage: '상황파악' };
  },
  async handleUtterance(
    _userId: string,
    _sessionId: string,
    _input: UtteranceInput,
  ): Promise<HandleUtteranceResult> {
    throw new Error('not used');
  },
  async end() {
    return { reason: 'user', finalRiskLevel: '저위험', artifactCount: 0 };
  },
};

function createFakeAdmin(): { api: AdminApi; users: Map<string, UserSummary> } {
  const users = new Map<string, UserSummary>([
    [ADMIN_ID, { userId: ADMIN_ID, email: 'admin@nadaum.ai', isAdmin: true, createdAt: '2026-01-01T00:00:00.000Z' }],
    [USER_ID, { userId: USER_ID, email: 'user@nadaum.ai', isAdmin: false, createdAt: '2026-02-01T00:00:00.000Z' }],
  ]);
  const api: AdminApi = {
    async listUsers() {
      return [...users.values()];
    },
    async deleteUser(userId) {
      users.delete(userId);
    },
    async setAdmin(userId, isAdmin) {
      const u = users.get(userId);
      if (u !== undefined) users.set(userId, { ...u, isAdmin });
    },
    async getUserDiaries(): Promise<{ items: DiaryEntry[]; hasNext: boolean }> {
      return { items: [], hasNext: false };
    },
    async setUserModel(userId, modelId) {
      const u = users.get(userId);
      if (u !== undefined) {
        const next = { ...u };
        if (modelId !== undefined) next.assignedModel = modelId;
        else delete next.assignedModel;
        users.set(userId, next);
      }
    },
    async getUserModel(userId) {
      return users.get(userId)?.assignedModel;
    },
  };
  return { api, users };
}

let server: http.Server;
let base: string;
let admin: ReturnType<typeof createFakeAdmin>;

beforeEach(() => {
  admin = createFakeAdmin();
});

beforeAll(async () => {
  admin = createFakeAdmin();
  const app = createApp({
    jwtSecret: SECRET,
    auth: fakeAuth,
    session: fakeSession,
    diaries: new DiaryQueryService(new InMemoryDiaryRepository()),
    admin: {
      listUsers: () => admin.api.listUsers(),
      deleteUser: (id) => admin.api.deleteUser(id),
      setAdmin: (id, v) => admin.api.setAdmin(id, v),
      getUserDiaries: (id, p) => admin.api.getUserDiaries(id, p),
      setUserModel: (id, m) => admin.api.setUserModel(id, m),
      getUserModel: (id) => admin.api.getUserModel(id),
    },
  });
  server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const addr = server.address() as AddressInfo;
  base = `http://127.0.0.1:${addr.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

function patch(path: string, body: unknown, token?: string): Promise<Response> {
  return fetch(`${base}${path}`, {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      ...(token !== undefined ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

describe('관리자 권한 부여/회수 엔드포인트', () => {
  it('일반 사용자 토큰은 403으로 거부한다', async () => {
    const res = await patch(`/admin/users/${USER_ID}/admin`, { isAdmin: true }, userToken);
    expect(res.status).toBe(403);
  });

  it('토큰이 없으면 401로 거부한다', async () => {
    const res = await patch(`/admin/users/${USER_ID}/admin`, { isAdmin: true });
    expect(res.status).toBe(401);
  });

  it('관리자가 다른 사용자에게 관리자 권한을 부여한다', async () => {
    const res = await patch(`/admin/users/${USER_ID}/admin`, { isAdmin: true }, adminToken);
    expect(res.status).toBe(204);
    expect(admin.users.get(USER_ID)?.isAdmin).toBe(true);
  });

  it('관리자가 다른 사용자의 관리자 권한을 회수한다', async () => {
    admin.users.set(USER_ID, { ...admin.users.get(USER_ID)!, isAdmin: true });
    const res = await patch(`/admin/users/${USER_ID}/admin`, { isAdmin: false }, adminToken);
    expect(res.status).toBe(204);
    expect(admin.users.get(USER_ID)?.isAdmin).toBe(false);
  });

  it('자기 자신의 관리자 권한 회수는 400으로 막는다 (잠금 방지)', async () => {
    const res = await patch(`/admin/users/${ADMIN_ID}/admin`, { isAdmin: false }, adminToken);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe('self_demotion_forbidden');
    expect(admin.users.get(ADMIN_ID)?.isAdmin).toBe(true);
  });
});
