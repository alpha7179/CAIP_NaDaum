// API HTTP 클라이언트
import type { DiaryEntry } from '@nadaum/shared';

import {
  ApiError,
  type AdminDiaryPage,
  type AdminUsersResponse,
  type AuthResponse,
  type DiaryListResponse,
  type EmotionTrendResponse,
  type GuardianDto,
  type GuardiansResponse,
  type MentalHealthResourcesResponse,
  type ModelsResponse,
  type NotificationPreferences,
  type NotionStatus,
  type RegisterRequest,
  type SessionEndResponse,
  type StartSessionResponse,
  type UtteranceRequest,
  type UtteranceResponse,
} from './types';

export type TokenProvider = () => string | undefined;

export interface ApiClient {
  register(body: RegisterRequest): Promise<AuthResponse>;
  checkEmail(email: string): Promise<{ available: boolean }>;
  login(body: { email: string; password: string }): Promise<AuthResponse>;
  changePassword(currentPassword: string, newPassword: string): Promise<void>;
  withdrawConsent(items: string[]): Promise<void>;
  deleteAccount(): Promise<void>;
  getNotificationPreferences(): Promise<NotificationPreferences>;
  setNotificationPreferences(prefs: Partial<NotificationPreferences>): Promise<NotificationPreferences>;
  getGuardians(): Promise<GuardiansResponse>;
  setGuardians(guardians: GuardianDto[]): Promise<GuardiansResponse>;
  getModels(): Promise<ModelsResponse>;
  startSession(model?: string): Promise<StartSessionResponse>;
  sendUtterance(sessionId: string, body: UtteranceRequest): Promise<UtteranceResponse>;
  endSession(sessionId: string, reason: SessionEndResponse['reason']): Promise<SessionEndResponse>;
  endSessionBeacon(sessionId: string, reason: SessionEndResponse['reason']): void;
  listDiaries(page: number): Promise<DiaryListResponse>;
  getDiary(diaryId: string): Promise<DiaryEntry>;
  updateDiary(diaryId: string, body: string): Promise<DiaryEntry>;
  summarizeDiary(diaryId: string, lines: number): Promise<{ summary: string }>;
  deleteDiary(diaryId: string): Promise<void>;
  getTrend(limit: number): Promise<EmotionTrendResponse>;
  getResources(): Promise<MentalHealthResourcesResponse>;
  getAdminUsers(): Promise<AdminUsersResponse>;
  deleteAdminUser(userId: string): Promise<void>;
  setAdminUser(userId: string, isAdmin: boolean): Promise<void>;
  setUserModel(userId: string, modelId: string | null): Promise<void>;
  getAdminUserDiaries(userId: string, page: number): Promise<AdminDiaryPage>;
  getNotionStatus(): Promise<NotionStatus>;
  connectNotion(token: string, pageUrl?: string): Promise<NotionStatus>;
  verifyNotionToken(token: string): Promise<{ valid: true; workspaceName?: string }>;
  updateNotionTarget(pageUrl?: string): Promise<NotionStatus>;
  disconnectNotion(): Promise<void>;
  exportDiaryToNotion(diaryId: string): Promise<{ url: string; pageId: string }>;
}

const DEFAULT_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '';

export function createApiClient(getToken: TokenProvider, baseUrl: string = DEFAULT_BASE_URL): ApiClient {
  async function request<T>(method: string, path: string, body?: unknown, auth = true): Promise<T> {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (auth) {
      const token = getToken();
      if (token !== undefined) headers.authorization = `Bearer ${token}`;
    }
    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    if (res.status === 204) return undefined as T;
    const text = await res.text();
    const data: unknown = text.length > 0 ? JSON.parse(text) : undefined;
    if (!res.ok) {
      const err = data as { error?: string; code?: string } | undefined;
      throw new ApiError(res.status, err?.error ?? `HTTP ${res.status}`, err?.code);
    }
    return data as T;
  }

  return {
    register: (body) => request<AuthResponse>('POST', '/auth/register', body, false),
    checkEmail: (email) =>
      request<{ available: boolean }>('GET', `/auth/check-email?email=${encodeURIComponent(email)}`, undefined, false),
    login: (body) => request<AuthResponse>('POST', '/auth/login', body, false),
    changePassword: (currentPassword, newPassword) =>
      request<void>('POST', '/auth/change-password', { currentPassword, newPassword }),
    withdrawConsent: (items) => request<void>('POST', '/auth/withdraw-consent', { items }),
    deleteAccount: () => request<void>('DELETE', '/auth/account'),
    getNotificationPreferences: () =>
      request<NotificationPreferences>('GET', '/me/notification-preferences'),
    setNotificationPreferences: (prefs) =>
      request<NotificationPreferences>('PATCH', '/me/notification-preferences', prefs),
    getGuardians: () => request<GuardiansResponse>('GET', '/me/guardians'),
    setGuardians: (guardians: GuardianDto[]) =>
      request<GuardiansResponse>('PUT', '/me/guardians', { guardians }),
    getModels: () => request<ModelsResponse>('GET', '/models', undefined, false),
    startSession: (model?) => request<StartSessionResponse>('POST', '/sessions', { model }),
    sendUtterance: (sessionId, body) =>
      request<UtteranceResponse>('POST', `/sessions/${encodeURIComponent(sessionId)}/utterances`, body),
    endSession: (sessionId, reason) =>
      request<SessionEndResponse>('POST', `/sessions/${encodeURIComponent(sessionId)}/end`, { reason }),
    endSessionBeacon: (sessionId, reason) => {
      const token = getToken();
      const headers: Record<string, string> = { 'content-type': 'application/json' };
      if (token !== undefined) headers.authorization = `Bearer ${token}`;
      try {
        void fetch(`${baseUrl}/sessions/${encodeURIComponent(sessionId)}/end`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ reason }),
          keepalive: true,
        }).catch(() => {});
      } catch {}
    },
    listDiaries: (page) => request<DiaryListResponse>('GET', `/diaries?page=${page}`),
    getDiary: (diaryId) => request<DiaryEntry>('GET', `/diaries/${encodeURIComponent(diaryId)}`),
    updateDiary: (diaryId, body) =>
      request<DiaryEntry>('PATCH', `/diaries/${encodeURIComponent(diaryId)}`, { body }),
    summarizeDiary: (diaryId, lines) =>
      request<{ summary: string }>('POST', `/diaries/${encodeURIComponent(diaryId)}/summary`, { lines }),
    deleteDiary: (diaryId) =>
      request<void>('DELETE', `/diaries/${encodeURIComponent(diaryId)}`),
    getTrend: (limit) => request<EmotionTrendResponse>('GET', `/diaries/trend?limit=${limit}`),
    getResources: () =>
      request<MentalHealthResourcesResponse>('GET', '/resources/mental-health', undefined, false),
    getAdminUsers: () => request<AdminUsersResponse>('GET', '/admin/users'),
    deleteAdminUser: (userId) => request<void>('DELETE', `/admin/users/${encodeURIComponent(userId)}`),
    setAdminUser: (userId, isAdmin) =>
      request<void>('PATCH', `/admin/users/${encodeURIComponent(userId)}/admin`, { isAdmin }),
    setUserModel: (userId, modelId) =>
      request<void>('PATCH', `/admin/users/${encodeURIComponent(userId)}/model`, { modelId }),
    getAdminUserDiaries: (userId, page) =>
      request<AdminDiaryPage>('GET', `/admin/users/${encodeURIComponent(userId)}/diaries?page=${page}`),
    getNotionStatus: () => request<NotionStatus>('GET', '/integrations/notion/status'),
    connectNotion: (token, pageUrl) =>
      request<NotionStatus>('POST', '/integrations/notion/connect', { token, ...(pageUrl !== undefined && pageUrl.length > 0 ? { pageUrl } : {}) }),
    verifyNotionToken: (token) =>
      request<{ valid: true; workspaceName?: string }>('POST', '/integrations/notion/verify-token', { token }),
    updateNotionTarget: (pageUrl) =>
      request<NotionStatus>('PATCH', '/integrations/notion/target', { ...(pageUrl !== undefined && pageUrl.length > 0 ? { pageUrl } : {}) }),
    disconnectNotion: () => request<void>('DELETE', '/integrations/notion'),
    exportDiaryToNotion: (diaryId) =>
      request<{ url: string; pageId: string }>('POST', `/diaries/${encodeURIComponent(diaryId)}/export/notion`),
  };
}
