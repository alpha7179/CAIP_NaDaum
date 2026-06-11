// Express 앱 통합 테스트
import http from 'node:http';
import type { AddressInfo } from 'node:net';

import type { CalibratedEmotion, DiaryEntry, EmotionScores } from '@nadaum/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';


import { InMemoryDiaryRepository } from '../adapters/persistence/DiaryRepository.js';
import { DiaryQueryService } from '../domain/query/DiaryQueryService.js';
import type { HandleUtteranceResult, UtteranceInput } from '../domain/session/SessionOrchestrator.js';

import { createApp } from './app.js';
import type { AuthApi, SessionApi } from './ports.js';
import { signJwt } from './security/jwt.js';

const SECRET = 'integration-secret';
const scores: EmotionScores = { 기쁨: 5, 슬픔: 6, 분노: 2, 불안: 4, 놀람: 1, 혐오: 2, 중립: 5 };
const calibrated: CalibratedEmotion = {
  combinedScores: scores,
  perChannel: [],
  missingChannels: [],
  policy: 'text_only',
};

const fakeAuth: AuthApi = {
  async register() {
    return { userId: 'u1', token: signJwt({ sub: 'u1' }, SECRET) };
  },
  async isEmailAvailable(email) {
    return email !== 'taken@b.com';
  },
  async login(body) {
    if (body.email === 'a@b.com' && body.password === 'pw') {
      return { userId: 'u1', token: signJwt({ sub: 'u1' }, SECRET) };
    }
    return undefined;
  },
  async withdrawConsent() {},
};

const fakeSession: SessionApi = {
  async start() {
    return { sessionId: 's1', stage: '상황파악' };
  },
  async handleUtterance(_userId: string, _sessionId: string, input: UtteranceInput): Promise<HandleUtteranceResult> {
    const transcript = input.text;
    return {
      ok: true,
      transcript,
      aiResponse: '그랬군요. 더 들려주세요.',
      emotion: calibrated,
      riskLevel: '저위험',
      perSignal: [],
      stage: '감정탐색',
      forceFinalize: false,
      dialogueDegraded: false,
    };
  },
  async end() {
    return { reason: 'user', finalRiskLevel: '저위험', artifactCount: 1 };
  },
};

function diary(diaryId: string): DiaryEntry {
  return {
    diaryId,
    userId: 'u1',
    sessionId: 's1',
    sessionDate: '2026-05-28',
    title: '오늘',
    tags: ['일상'],
    bodyType: 'brief',
    body: '오늘의 일기',
    emotionScores: scores,
    peakRiskLevel: '저위험',
    createdAt: new Date('2026-05-28T10:00:00.000Z'),
  };
}

let server: http.Server;
let base: string;
const token = signJwt({ sub: 'u1' }, SECRET);

beforeAll(async () => {
  const repo = new InMemoryDiaryRepository();
  await repo.insert(diary('d1'));
  const app = createApp({
    jwtSecret: SECRET,
    auth: fakeAuth,
    session: fakeSession,
    diaries: new DiaryQueryService(repo),
  });
  server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const addr = server.address() as AddressInfo;
  base = `http://127.0.0.1:${addr.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

function post(path: string, body: unknown, auth = false): Promise<Response> {
  return fetch(`${base}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(auth ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

function get(path: string, auth = false): Promise<Response> {
  return fetch(`${base}${path}`, {
    headers: auth ? { authorization: `Bearer ${token}` } : {},
  });
}

describe('Express app integration', () => {
  it('serves OpenAPI spec publicly', async () => {
    const res = await get('/openapi.json');
    expect(res.status).toBe(200);
    const spec = (await res.json()) as { openapi: string };
    expect(spec.openapi).toBe('3.1.0');
  });

  it('serves mental-health resources publicly', async () => {
    const res = await get('/resources/mental-health');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { emergencyContacts: unknown[] };
    expect(body.emergencyContacts.length).toBeGreaterThan(0);
  });

  it('registers and returns a token', async () => {
    const res = await post('/auth/register', {
      email: 'a@b.com',
      password: 'pw',
      consentItems: { privacyPolicy: true, nonMedicalDisclaimer: true, guardianNotification: true },
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { token: string };
    expect(typeof body.token).toBe('string');
  });

  it('rejects invalid login with 401', async () => {
    const res = await post('/auth/login', { email: 'a@b.com', password: 'wrong' });
    expect(res.status).toBe(401);
  });

  it('checks email availability in real time', async () => {
    const free = await get('/auth/check-email?email=new%40b.com');
    expect(free.status).toBe(200);
    expect(((await free.json()) as { available: boolean }).available).toBe(true);

    const taken = await get('/auth/check-email?email=taken%40b.com');
    expect(taken.status).toBe(200);
    expect(((await taken.json()) as { available: boolean }).available).toBe(false);

    const invalid = await get('/auth/check-email?email=not-an-email');
    expect(invalid.status).toBe(400);
  });

  it('rejects protected routes without a token', async () => {
    const res = await post('/sessions', {});
    expect(res.status).toBe(401);
  });

  it('starts a session and processes a text utterance with a token', async () => {
    const start = await post('/sessions', {}, true);
    expect(start.status).toBe(201);

    const utt = await post('/sessions/s1/utterances', { text: '오늘 우울했어' }, true);
    expect(utt.status).toBe(200);
    const body = (await utt.json()) as { aiResponse: string; riskLevel: string };
    expect(body.riskLevel).toBe('저위험');
    expect(body.aiResponse.length).toBeGreaterThan(0);
  });

  it('lists diaries and fetches one by id', async () => {
    const list = await get('/diaries?page=0', true);
    expect(list.status).toBe(200);
    const page = (await list.json()) as { items: DiaryEntry[]; hasNext: boolean };
    expect(page.items).toHaveLength(1);

    const single = await get('/diaries/d1', true);
    expect(single.status).toBe(200);

    const missing = await get('/diaries/nope', true);
    expect(missing.status).toBe(404);
  });

  it('returns emotion trend', async () => {
    const res = await get('/diaries/trend?limit=7', true);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { points: unknown[] };
    expect(Array.isArray(body.points)).toBe(true);
  });

  it('ends a session', async () => {
    const res = await post('/sessions/s1/end', { reason: 'user' }, true);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { reason: string };
    expect(body.reason).toBe('user');
  });
});
