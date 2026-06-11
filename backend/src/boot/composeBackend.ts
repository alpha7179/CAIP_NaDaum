// 백엔드 합성 루트 — 외부 AI 어댑터 자동 선택 및 도메인 파이프라인 조립.

import { randomUUID, createHash } from 'node:crypto';
import { createServer, type Server } from 'node:http';

import type { Application } from 'express';
import { Redis } from 'ioredis';
import pg from 'pg';

const { Pool } = pg;

import { PassthroughHook } from '../adapters/ai-gateway/PassthroughHook.js';
import { FAKE_EXTERNAL_ADAPTERS } from '../adapters/ai-gateway/__fakes__/fakeExternalAdapters.js';
import { createBoundGateway } from '../adapters/ai-gateway/boundGateway.js';
import {
  createGeminiAdapters,
  createGeminiDialogueAdapter,
  type GeminiChatConfig,
} from '../adapters/ai-gateway/gemini/GeminiExternalAdapters.js';
import {
  createOpenAiEmbeddingAdapter,
  type OpenAiEmbeddingConfig,
} from '../adapters/ai-gateway/openai/OpenAiEmbeddingAdapter.js';
import {
  createOpenAiAdapters,
  createOpenAiDialogueAdapter,
  type OpenAiChatConfig,
} from '../adapters/ai-gateway/openai/OpenAiExternalAdapters.js';
import { ArtifactPersistencePipeline } from '../adapters/artifact/ArtifactPersistencePipeline.js';
import { DiaryProducer, type DiaryAIGateway } from '../adapters/artifact/DiaryProducer.js';
import { createPgAdminApi } from '../adapters/auth/PgAdminApi.js';
import { createPgAuthApi } from '../adapters/auth/PgAuthApi.js';
import { ProtectedAdminError, isProtectedAdminEmail } from '../adapters/auth/adminProtection.js';
import { Gpt4oDialogueAdapter, type DialogueAIGateway } from '../adapters/dialogue/Gpt4oDialogueAdapter.js';
import { DiaryRecallReaderAdapter } from '../adapters/diary-recall/DiaryRecallReaderAdapter.js';
import {
  GatewayDiaryEmbedder,
  type EmbeddingAIGateway,
} from '../adapters/diary-recall/GatewayDiaryEmbedder.js';
import { TextChannel, type EmotionAIGateway } from '../adapters/emotion/TextChannel.js';
import { DialogueEngineImpl } from '../domain/dialogue/DialogueEngine.js';
import { createMvpEmotionAnalyzer } from '../domain/emotion/EmotionAnalyzer.js';
import { createMvpRiskEvaluator } from '../domain/risk/RiskEvaluator.js';
import {
  SuicidalityModelAdapter,
  type RiskAIGateway,
} from '../adapters/risk/SuicidalityModelAdapter.js';
import { SafetyProtocol, type GuardianNotifier } from '../domain/safety/SafetyProtocol.js';
import { NotificationChannelRegistry } from '../domain/notification/NotificationChannelRegistry.js';
import { EmailNotificationAdapter } from '../adapters/notification/EmailNotificationAdapter.js';
import { createSesEmailSender } from '../adapters/notification/sesEmailSender.js';
import { SmsNotificationAdapter } from '../adapters/notification/SmsNotificationAdapter.js';
import { createSnsSmsSender } from '../adapters/notification/snsSmsSender.js';
import { InMemorySafetyAuditLogger, PgSafetyAuditLogger, type SafetyAuditLogger } from '../adapters/persistence/SafetyAuditLogger.js';
import { InMemorySessionRepository, RedisSessionRepository } from '../adapters/persistence/SessionRepository.js';
import {
  InMemoryDiaryRepository,
  InMemorySemanticDiarySearch,
  PgDiaryRepository,
  PgSemanticDiarySearch,
  type DiaryEmbeddingPersistence,
} from '../adapters/persistence/DiaryRepository.js';
import { InMemoryArtifactRepository, PgArtifactRepository } from '../adapters/persistence/ArtifactRepository.js';
import { PgUserRepository } from '../adapters/persistence/PgUserRepository.js';
import { PgConsentRepository } from '../adapters/persistence/ConsentRepository.js';
import { PgGuardianRepository } from '../adapters/persistence/GuardianRepository.js';
import { PgTransactionRunner } from '../adapters/persistence/PgTransactionRunner.js';
import {
  InMemoryNotionConnectionRepository,
  PgNotionConnectionRepository,
  type NotionConnectionRepository,
} from '../adapters/notion/NotionConnectionRepository.js';
import type { DiaryRepository, ArtifactRepository } from '../domain/diary/ports.js';
import { SessionOrchestrator } from '../domain/session/SessionOrchestrator.js';
import type { SessionRepository } from '../domain/session/SessionRepository.js';
import { AuthService } from '../domain/auth/AuthService.js';
import { AuthValidationError } from '../domain/auth/types.js';
import { DiarySummarizer, type SummaryAIGateway } from '../adapters/summary/DiarySummarizer.js';
import { ArtifactProducerRegistry } from '../domain/artifact/ArtifactProducerRegistry.js';
import { DiaryQueryService } from '../domain/query/DiaryQueryService.js';
import { DiaryRecallService } from '../domain/diary/recall/DiaryRecallService.js';
import { AIGatewayImpl } from '../domain/ai-gateway/AIGateway.js';
import type { DiaryEmbedder, SemanticDiarySearch } from '../domain/diary/recall/ports.js';
import { createApp } from '../transport/app.js';
import type { AdminApi, AuthApi, AvailableModel, GuardianDto, SessionApi } from '../transport/ports.js';
import { SessionEventHub } from '../transport/realtime/SessionEventHub.js';
import { attachWebSocket, registerSse } from '../transport/realtime/ws.js';
import { signJwt } from '../transport/security/jwt.js';

export interface ComposedBackend {
  readonly app: Application;
  readonly server: Server;
  readonly hub: SessionEventHub;
  readonly usingRealOpenAi: boolean;
  readonly aiProvider: 'openai' | 'gemini' | 'fake';
}

interface InMemoryUserRecord {
  userId: string;
  passwordHash: string;
  isAdmin: boolean;
  email: string;
  name?: string;
  createdAt: string;
  assignedModel?: string;
  photoUrl?: string;
}

function createInMemoryAuthApi(jwtSecret: string): { authApi: AuthApi; adminUsers: Map<string, InMemoryUserRecord>; adminGoogleUsers: Map<string, string> } {
  const adminEmail = process.env['ADMIN_EMAIL'] ?? 'admin@nadaum.ai';
  const _imAdminPw = process.env['ADMIN_PASSWORD'];
  const adminPassword = typeof _imAdminPw === 'string' && _imAdminPw.length > 0 ? _imAdminPw : 'admin';
  const hash = (pw: string): string => createHash('sha256').update(pw).digest('hex');
  const adminId = randomUUID();
  const users = new Map<string, InMemoryUserRecord>([
    [adminEmail, { userId: adminId, passwordHash: hash(adminPassword), isAdmin: true, email: adminEmail, name: '관리자', createdAt: new Date().toISOString() }],
  ]);
  const googleUsers = new Map<string, string>();
  const notificationPrefs = new Map<string, { emailEnabled: boolean; smsEnabled: boolean }>();
  const guardiansStore = new Map<string, GuardianDto[]>();
  const issue = (userId: string, isAdmin = false): string =>
    signJwt({ sub: userId, ...(isAdmin ? { admin: true } : {}) }, jwtSecret, { expiresInSec: 60 * 60 * 24 });

  const authApi: AuthApi = {
    async register(body) {
      const items = body.consentItems;
      if (!items?.privacyPolicy || !items?.nonMedicalDisclaimer || !items?.guardianNotification) {
        throw new AuthValidationError('consent_missing', '필수 동의 항목이 누락되었습니다.');
      }
      if (users.has(body.email)) {
        throw new AuthValidationError('email_taken', '이미 가입된 이메일입니다.');
      }
      const userId = randomUUID();
      const isAdmin = adminEmail !== undefined && body.email === adminEmail;
      users.set(body.email, { userId, passwordHash: hash(body.password), isAdmin, email: body.email, ...(body.name !== undefined ? { name: body.name } : {}), createdAt: new Date().toISOString() });
      return { userId, token: issue(userId, isAdmin), isAdmin, ...(body.name !== undefined ? { name: body.name } : {}) };
    },
    async isEmailAvailable(email) {
      return !users.has(email);
    },
    async login(body) {
      const found = users.get(body.email);
      if (found === undefined || found.passwordHash !== hash(body.password)) {
        return undefined;
      }
      return {
        userId: found.userId,
        token: issue(found.userId, found.isAdmin),
        isAdmin: found.isAdmin,
        ...(found.name !== undefined ? { name: found.name } : {}),
      };
    },
    async loginWithGoogle(googleId, email, _name, photoUrl) {
      let userId = googleUsers.get(googleId);
      if (userId === undefined) {
        const existing = users.get(email);
        userId = existing?.userId ?? randomUUID();
        googleUsers.set(googleId, userId);
        if (existing === undefined) {
          const isAdmin = adminEmail !== undefined && email === adminEmail;
          users.set(email, { userId, passwordHash: '', isAdmin, email, createdAt: new Date().toISOString(), ...(photoUrl !== undefined ? { photoUrl } : {}) });
        } else if (photoUrl !== undefined) {
          existing.photoUrl = photoUrl;
        }
      } else if (photoUrl !== undefined) {
        const record = [...users.values()].find((r) => r.userId === userId);
        if (record !== undefined) record.photoUrl = photoUrl;
      }
      const record = [...users.values()].find((r) => r.userId === userId);
      return { userId, token: issue(userId, record?.isAdmin ?? false), isAdmin: record?.isAdmin ?? false };
    },
    async changePassword(userId, currentPassword, newPassword) {
      for (const record of users.values()) {
        if (record.userId === userId) {
          if (record.passwordHash !== hash(currentPassword)) return false;
          record.passwordHash = hash(newPassword);
          return true;
        }
      }
      return false;
    },
    async withdrawConsent() {},
    async deleteAccount(userId) {
      for (const [email, record] of users.entries()) {
        if (record.userId === userId) { users.delete(email); break; }
      }
      for (const [gId, uid] of googleUsers.entries()) {
        if (uid === userId) { googleUsers.delete(gId); break; }
      }
    },
    async getNotificationPreferences(userId) {
      return notificationPrefs.get(userId) ?? { emailEnabled: true, smsEnabled: true };
    },
    async setNotificationPreferences(userId, prefs) {
      const current = notificationPrefs.get(userId) ?? { emailEnabled: true, smsEnabled: true };
      notificationPrefs.set(userId, {
        emailEnabled: prefs.emailEnabled ?? current.emailEnabled,
        smsEnabled: prefs.smsEnabled ?? current.smsEnabled,
      });
    },
    async getGuardians(userId) {
      return guardiansStore.get(userId) ?? [];
    },
    async setGuardians(userId, guardians) {
      guardiansStore.set(userId, guardians.slice(0, 5));
    },
  };

  return { authApi, adminUsers: users, adminGoogleUsers: googleUsers };
}

export function composeBackend(): ComposedBackend {
  const jwtSecret      = process.env['JWT_SECRET'] ?? 'dev-insecure-secret-change-me';
  const openAiKey      = process.env['OPENAI_API_KEY'];
  const openAiBaseUrl  = process.env['OPENAI_BASE_URL'];
  const openAiModel    = process.env['OPENAI_MODEL'];
  const geminiKey      = process.env['GEMINI_API_KEY'];
  const geminiBaseUrl  = process.env['GEMINI_BASE_URL'];
  const geminiModel    = process.env['GEMINI_MODEL'];
  const hasOpenAi  = typeof openAiKey === 'string' && openAiKey.length > 0;
  const hasGemini  = typeof geminiKey === 'string' && geminiKey.length > 0;

  const usingGemini = hasGemini;
  const usingOpenAi = !hasGemini && hasOpenAi;
  const usingRealOpenAi = usingOpenAi;

  const gateway = new AIGatewayImpl(new PassthroughHook());

  const geminiConfig: GeminiChatConfig | undefined = hasGemini
    ? {
        apiKey: geminiKey,
        ...(typeof geminiBaseUrl === 'string' && geminiBaseUrl.length > 0 ? { baseUrl: geminiBaseUrl } : {}),
        ...(typeof geminiModel === 'string' && geminiModel.length > 0 ? { model: geminiModel } : {}),
      }
    : undefined;
  const openAiConfig: OpenAiChatConfig | undefined = hasOpenAi
    ? {
        apiKey: openAiKey,
        ...(typeof openAiBaseUrl === 'string' && openAiBaseUrl.length > 0 ? { baseUrl: openAiBaseUrl } : {}),
        ...(typeof openAiModel === 'string' && openAiModel.length > 0 ? { model: openAiModel } : {}),
      }
    : undefined;

  if (usingGemini) {
    const g = createGeminiAdapters(geminiConfig!);
    gateway.registerAdapter('gpt4o_emotion', g.gpt4o_emotion);
    gateway.registerAdapter('gpt4o_dialogue', g.gpt4o_dialogue);
    gateway.registerAdapter('gpt4o_diary', g.gpt4o_diary);
    gateway.registerAdapter('gpt4o_risk', g.gpt4o_risk);
  } else if (usingOpenAi) {
    const o = createOpenAiAdapters(openAiConfig);
    gateway.registerAdapter('gpt4o_emotion', o.gpt4o_emotion);
    gateway.registerAdapter('gpt4o_dialogue', o.gpt4o_dialogue);
    gateway.registerAdapter('gpt4o_diary', o.gpt4o_diary);
    gateway.registerAdapter('gpt4o_risk', o.gpt4o_risk);
  } else {
    gateway.registerAdapter('gpt4o_emotion', FAKE_EXTERNAL_ADAPTERS.gpt4o_emotion);
    gateway.registerAdapter('gpt4o_dialogue', FAKE_EXTERNAL_ADAPTERS.gpt4o_dialogue);
    gateway.registerAdapter('gpt4o_diary', FAKE_EXTERNAL_ADAPTERS.gpt4o_diary);
    gateway.registerAdapter('gpt4o_risk', FAKE_EXTERNAL_ADAPTERS.gpt4o_risk);
  }

  const embeddingsEnabled = process.env['EMBEDDINGS_ENABLED'] !== 'false';
  const hasEmbeddingProvider = hasOpenAi && embeddingsEnabled;
  if (hasEmbeddingProvider) {
    const embeddingConfig: OpenAiEmbeddingConfig = {
      apiKey: openAiKey,
      ...(typeof openAiBaseUrl === 'string' && openAiBaseUrl.length > 0
        ? { baseUrl: openAiBaseUrl }
        : {}),
    };
    gateway.registerAdapter('embedding', createOpenAiEmbeddingAdapter(embeddingConfig));
    console.log('[compose] embedding adapter: enabled (OpenAI text-embedding-3-small)');
  } else {
    console.log(
      `[compose] embedding adapter: disabled (${!embeddingsEnabled ? 'EMBEDDINGS_ENABLED=false' : 'OpenAI 키 없음'} — 회상은 (A) 날짜 기반만 동작)`,
    );
  }

  const bound = createBoundGateway(gateway, { userId: 'system' });

  const STANDARD_OPENAI_MODELS: AvailableModel[] = [
    { id: 'gpt-4o',      label: 'GPT-4o',      description: '최고 성능 모델',     provider: 'openai' },
    { id: 'gpt-4o-mini', label: 'GPT-4o mini', description: '빠르고 가벼운 모델', provider: 'openai' },
  ];
  const GATEWAY_MODELS: AvailableModel[] = [
    { id: 'gpt-5-chat-latest',   label: 'GPT-5 Chat',        description: '최신 GPT-5 채팅 모델',      provider: 'openai' },
    { id: 'gpt-5.1-chat-latest', label: 'GPT-5.1 Chat',      description: '최신 GPT-5.1 채팅 모델',    provider: 'openai' },
    { id: 'gpt-5-mini',          label: 'GPT-5 mini',        description: '경량 GPT-5 모델',            provider: 'openai' },
    { id: 'gpt-4o',              label: 'GPT-4o',            description: '안정적인 GPT-4o',            provider: 'openai' },
    { id: 'gpt-4o-mini',         label: 'GPT-4o mini',       description: '빠르고 가벼운 GPT-4o',       provider: 'openai' },
    { id: 'claude-sonnet-4-5-20250929', label: 'Claude Sonnet 4.5', description: 'Anthropic 고성능 모델', provider: 'anthropic' },
    { id: 'claude-opus-4-5-20251101',   label: 'Claude Opus 4.5',   description: 'Anthropic 최고 성능',   provider: 'anthropic' },
    { id: 'claude-haiku-4-5-20251001',  label: 'Claude Haiku 4.5',  description: 'Anthropic 경량 모델',   provider: 'anthropic' },
    { id: 'gemini-2.5-flash',    label: 'Gemini 2.5 Flash',  description: 'Google 빠른 응답 모델',      provider: 'google' },
    { id: 'gemini-2.5-pro',      label: 'Gemini 2.5 Pro',    description: 'Google 고성능 추론 모델',    provider: 'google' },
    { id: 'grok-4',              label: 'Grok 4',            description: 'xAI 최신 추론 모델',         provider: 'xai' },
    { id: 'grok-3-mini',         label: 'Grok 3 mini',       description: 'xAI 경량 모델',              provider: 'xai' },
  ];
  const GEMINI_MODELS: AvailableModel[] = [
    { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', description: '빠른 응답 모델',   provider: 'gemini' },
    { id: 'gemini-2.5-pro',   label: 'Gemini 2.5 Pro',   description: '고성능 추론 모델', provider: 'gemini' },
  ];
  const FAKE_MODELS: AvailableModel[] = [
    { id: 'fake', label: 'Fake AI (개발용)', description: '결정적 테스트 응답', provider: 'fake' },
  ];
  const usingGateway = usingOpenAi && typeof openAiBaseUrl === 'string' && openAiBaseUrl.length > 0;
  const openAiModelList = usingGateway ? GATEWAY_MODELS : STANDARD_OPENAI_MODELS;
  const availableModels = usingGemini ? GEMINI_MODELS : usingOpenAi ? openAiModelList : FAKE_MODELS;
  const envDefaultId = typeof openAiModel === 'string' && openAiModel.length > 0 ? openAiModel : undefined;
  const defaultModelId = (envDefaultId !== undefined && availableModels.some((m) => m.id === envDefaultId))
    ? envDefaultId
    : availableModels[0]!.id;

  const emotion = createMvpEmotionAnalyzer(
    new TextChannel({ gateway: bound as unknown as EmotionAIGateway }),
  );
  const HIGH_RISK_KEYWORDS: ReadonlyArray<string> = [
    '자살', '죽고싶다', '죽고싶어', '목매달', '뛰어내리', '투신', '죽어버리',
    '사라지고싶다', '사라지고싶어', '없어지고싶다',
    '자해', '손목긋', '칼로긋', '베어버리',
    '죽여버리', '다부숴', '다죽일',
  ];
  const { evaluator, keywordSignal } = createMvpRiskEvaluator({
    isHighRisk: (text: string) => {
      const norm = text.normalize('NFC').replace(/\s+/g, '');
      return HIGH_RISK_KEYWORDS.some((kw) => norm.includes(kw.replace(/\s+/g, '')));
    },
    loadKeywords: () => HIGH_RISK_KEYWORDS,
  });
  void keywordSignal.refresh();

  const riskModel = new SuicidalityModelAdapter({
    gateway: bound as unknown as RiskAIGateway,
  });

  function makeDialogueEngine(modelId: string): DialogueEngineImpl {
    const gw = new AIGatewayImpl(new PassthroughHook());
    if (usingGemini) {
      gw.registerAdapter('gpt4o_dialogue', createGeminiDialogueAdapter({ ...geminiConfig!, model: modelId }));
    } else if (usingOpenAi) {
      gw.registerAdapter('gpt4o_dialogue', createOpenAiDialogueAdapter({ ...openAiConfig!, model: modelId }));
    } else {
      gw.registerAdapter('gpt4o_dialogue', FAKE_EXTERNAL_ADAPTERS.gpt4o_dialogue);
    }
    const b = createBoundGateway(gw, { userId: 'system' });
    return new DialogueEngineImpl(new Gpt4oDialogueAdapter({ gateway: b as unknown as DialogueAIGateway }));
  }
  const databaseUrl = process.env['DATABASE_URL'];
  const redisUrl = process.env['REDIS_URL'];
  const useDb = typeof databaseUrl === 'string' && databaseUrl.length > 0;
  const useRedis = typeof redisUrl === 'string' && redisUrl.length > 0;
  const pool = useDb ? new Pool({ connectionString: databaseUrl }) : undefined;

  let diaryRepo: DiaryRepository;
  let artifactRepo: ArtifactRepository;
  let auditLogger: SafetyAuditLogger;
  let authApi: AuthApi;
  let semanticSearch: SemanticDiarySearch | undefined;
  let diaryEmbeddingPersistence: DiaryEmbeddingPersistence | undefined;
  let guardianNotifier: GuardianNotifier | undefined;
  let inMemoryUsers: Map<string, InMemoryUserRecord> | undefined;
  let inMemoryGoogleUsers: Map<string, string> | undefined;

  if (pool !== undefined) {
    const pgDiaries = new PgDiaryRepository(pool);
    diaryRepo = pgDiaries;
    diaryEmbeddingPersistence = pgDiaries;
    semanticSearch = new PgSemanticDiarySearch(pool);
    artifactRepo = new PgArtifactRepository(pool);
    auditLogger = new PgSafetyAuditLogger(pool);
    const consentRepo = new PgConsentRepository(pool);
    const guardianRepo = new PgGuardianRepository(pool);
    const authService = new AuthService({
      users: new PgUserRepository(pool),
      consents: consentRepo,
      guardians: guardianRepo,
      transactions: new PgTransactionRunner(pool),
    });
    authApi = createPgAuthApi(pool, authService, jwtSecret);

    guardianNotifier = {
      async resolveNotification(userId) {
        const guardians = await guardianRepo.listByUserId(userId);
        const recipients = guardians.map((g) => ({
          guardianId: g.guardianId,
          name: g.name,
          email: g.email,
          phone: g.phone,
          emailEnabled: g.emailEnabled,
          smsEnabled: g.smsEnabled,
        }));

        const prefs = await pool.query<{ alert_email_enabled: boolean; alert_sms_enabled: boolean }>(
          'SELECT alert_email_enabled, alert_sms_enabled FROM users WHERE user_id = $1 LIMIT 1',
          [userId],
        );
        const row = prefs.rows[0];
        const enabledChannels = new Set<string>();
        if (row?.alert_email_enabled ?? true) enabledChannels.add('email');
        if (row?.alert_sms_enabled ?? true) enabledChannels.add('sms');

        return { recipients, enabledChannels };
      },
    };
  } else {
    const memDiaries = new InMemoryDiaryRepository();
    diaryRepo = memDiaries;
    diaryEmbeddingPersistence = memDiaries;
    semanticSearch = new InMemorySemanticDiarySearch(memDiaries);
    artifactRepo = new InMemoryArtifactRepository();
    auditLogger = new InMemorySafetyAuditLogger();
    const inMemory = createInMemoryAuthApi(jwtSecret);
    authApi = inMemory.authApi;
    inMemoryUsers = inMemory.adminUsers;
    inMemoryGoogleUsers = inMemory.adminGoogleUsers;
  }
  const sessionRepo: SessionRepository = useRedis
    ? new RedisSessionRepository(new Redis(redisUrl))
    : new InMemorySessionRepository();

  console.log(`[compose] persistence: db=${useDb ? 'postgres' : 'memory'} session=${useRedis ? 'redis' : 'memory'} auth=${useDb ? 'pg' : 'memory'}`);

  const notificationRegistry = new NotificationChannelRegistry();
  const sesFromEmail = process.env['SES_FROM_EMAIL'];
  const awsRegion = process.env['AWS_REGION'];
  const smsAlertsEnabled = process.env['SMS_ALERTS_ENABLED'] === 'true';
  const smsSenderId = process.env['SMS_SENDER_ID'];
  const hasDbForGuardians = guardianNotifier !== undefined;
  const emailEnabled =
    hasDbForGuardians && typeof sesFromEmail === 'string' && sesFromEmail.length > 0;
  const smsEnabled = hasDbForGuardians && smsAlertsEnabled;

  if (emailEnabled) {
    notificationRegistry.register(
      new EmailNotificationAdapter({
        sender: createSesEmailSender({
          fromAddress: sesFromEmail,
          ...(typeof awsRegion === 'string' && awsRegion.length > 0 ? { region: awsRegion } : {}),
        }),
      }),
    );
    console.log('[compose] guardian email alerts: enabled (AWS SES)');
  }
  if (smsEnabled) {
    notificationRegistry.register(
      new SmsNotificationAdapter({
        sender: createSnsSmsSender({
          ...(typeof awsRegion === 'string' && awsRegion.length > 0 ? { region: awsRegion } : {}),
          ...(typeof smsSenderId === 'string' && smsSenderId.length > 0 ? { senderId: smsSenderId } : {}),
        }),
      }),
    );
    console.log('[compose] guardian SMS alerts: enabled (AWS SNS)');
  }

  const safety = new SafetyProtocol({
    auditLogger,
    notificationRegistry,
    ...(guardianNotifier !== undefined && (emailEnabled || smsEnabled)
      ? { guardianNotifier }
      : {}),
  });

  const registry = new ArtifactProducerRegistry({ idFactory: () => randomUUID() });
  registry.register(
    new DiaryProducer({ gateway: bound as unknown as DiaryAIGateway, idFactory: () => randomUUID() }),
  );

  const diaryEmbedder: DiaryEmbedder | undefined = hasEmbeddingProvider
    ? new GatewayDiaryEmbedder({ gateway: bound as unknown as EmbeddingAIGateway })
    : undefined;

  const pipeline = new ArtifactPersistencePipeline({
    registry,
    diaries: diaryRepo,
    artifacts: artifactRepo,
    ...(diaryEmbedder !== undefined ? { embedder: diaryEmbedder } : {}),
    ...(diaryEmbeddingPersistence !== undefined
      ? { embeddingPersistence: diaryEmbeddingPersistence }
      : {}),
  });

  const diaryRecall = new DiaryRecallService({
    reader: new DiaryRecallReaderAdapter({
      diaries: diaryRepo,
      ...(semanticSearch !== undefined ? { semantic: semanticSearch } : {}),
    }),
    ...(diaryEmbedder !== undefined ? { embedder: diaryEmbedder } : {}),
  });

  const orchestrators = new Map<string, SessionOrchestrator>();
  for (const m of availableModels) {
    orchestrators.set(m.id, new SessionOrchestrator({
      emotion,
      dialogue: makeDialogueEngine(m.id),
      risk: evaluator,
      riskModel,
      safety,
      sessions: sessionRepo,
      recall: diaryRecall,
      artifacts: pipeline,
      consents: { getConsents: (userId) => ({ userId, granted: { emotion_diary: true } }) },
      idFactory: () => randomUUID(),
    }));
  }
  const sessionToModelId = new Map<string, string>();
  function resolveOrchestrator(sessionId: string): SessionOrchestrator {
    const modelId = sessionToModelId.get(sessionId) ?? defaultModelId;
    return (orchestrators.get(modelId) ?? orchestrators.get(defaultModelId))!;
  }

  const diaryQuery = new DiaryQueryService(diaryRepo);

  const adminApi: AdminApi = pool !== undefined
    ? createPgAdminApi(pool, diaryQuery)
    : {
        async listUsers() {
          return [...inMemoryUsers!.values()].map((r) => ({
            userId: r.userId, email: r.email, ...(r.name !== undefined ? { name: r.name } : {}), isAdmin: r.isAdmin, createdAt: r.createdAt,
            ...(r.assignedModel !== undefined ? { assignedModel: r.assignedModel } : {}),
            ...(r.photoUrl !== undefined ? { photoUrl: r.photoUrl } : {}),
          }));
        },
        async deleteUser(userId) {
          for (const [email, record] of inMemoryUsers!.entries()) {
            if (record.userId === userId) {
              if (isProtectedAdminEmail(record.email)) throw new ProtectedAdminError();
              inMemoryUsers!.delete(email);
              break;
            }
          }
          for (const [gId, uid] of inMemoryGoogleUsers!.entries()) {
            if (uid === userId) { inMemoryGoogleUsers!.delete(gId); break; }
          }
        },
        async setAdmin(userId, isAdmin) {
          for (const record of inMemoryUsers!.values()) {
            if (record.userId === userId) {
              if (!isAdmin && isProtectedAdminEmail(record.email)) throw new ProtectedAdminError();
              record.isAdmin = isAdmin;
              break;
            }
          }
        },
        async getUserDiaries(userId, page) {
          const result = await diaryQuery.list(userId, page);
          return { items: result.items, hasNext: result.hasNext };
        },
        async setUserModel(userId, modelId) {
          for (const record of inMemoryUsers!.values()) {
            if (record.userId === userId) {
              if (modelId !== undefined && modelId.length > 0) record.assignedModel = modelId;
              else delete record.assignedModel;
              break;
            }
          }
        },
        async getUserModel(userId) {
          for (const record of inMemoryUsers!.values()) {
            if (record.userId === userId) return record.assignedModel;
          }
          return undefined;
        },
      };

  if (pool !== undefined) {
    const adminEmail = process.env['ADMIN_EMAIL'] ?? 'admin@nadaum.ai';
    const _adminPwRaw = process.env['ADMIN_PASSWORD'];
    const adminPassword = typeof _adminPwRaw === 'string' && _adminPwRaw.length > 0 ? _adminPwRaw : undefined;
    void (async () => {
      try {
        const exists = await pool.query<{ user_id: string }>(
          'SELECT user_id FROM users WHERE email = $1 LIMIT 1',
          [adminEmail],
        );
        if (exists.rows.length === 0) {
          if (adminPassword === undefined) {
            console.warn(
              '[seed] ADMIN_PASSWORD 미설정 — 약한 기본 비밀번호 사용을 막기 위해 관리자 시드를 건너뜁니다. ' +
                'Secrets Manager(또는 .env)에 ADMIN_PASSWORD를 설정한 뒤 재시작하세요.',
            );
            return;
          }
          const { hashPassword } = await import('../adapters/auth/password.js');
          const passwordHash = await hashPassword(adminPassword);
          await pool.query(
            'INSERT INTO users (user_id, email, password_hash, is_admin, name, created_at) VALUES ($1, $2, $3, true, $4, now())',
            [randomUUID(), adminEmail, passwordHash, '관리자'],
          );
          console.log(`[seed] 관리자 계정 생성: ${adminEmail}`);
        } else {
          await pool.query(
            "UPDATE users SET is_admin = true, name = COALESCE(name, '관리자') WHERE email = $1",
            [adminEmail],
          );
        }
      } catch (e) {
        console.warn('[seed] 관리자 계정 시드 실패:', e);
      }
    })();
  }

  const sessionApi: SessionApi = {
    start: async (userId, model, isAdmin) => {
      const assigned = await adminApi.getUserModel(userId).catch(() => undefined);
      const pick = (m: string | undefined): string | undefined =>
        (m !== undefined && orchestrators.has(m)) ? m : undefined;
      const modelId = isAdmin === true
        ? (pick(model) ?? pick(assigned) ?? defaultModelId)
        : (pick(assigned) ?? defaultModelId);
      if (isAdmin === true && pick(model) !== undefined && model !== assigned) {
        void adminApi.setUserModel(userId, modelId).catch(() => {});
      }
      const ctx = await (orchestrators.get(modelId)!).startSession(userId);
      sessionToModelId.set(ctx.sessionId, modelId);
      return { sessionId: ctx.sessionId, stage: ctx.stage, model: modelId };
    },
    handleUtterance: (_userId, sessionId, input) =>
      resolveOrchestrator(sessionId).handleUtterance(sessionId, input),
    end: async (_userId, sessionId, reason) => {
      const r = await resolveOrchestrator(sessionId).endSession(sessionId, reason);
      sessionToModelId.delete(sessionId);
      return { reason: r.reason, finalRiskLevel: r.finalRiskLevel, artifactCount: r.artifacts.length };
    },
  };

  const googleClientId = process.env['GOOGLE_CLIENT_ID'];
  const googleClientSecret = process.env['GOOGLE_CLIENT_SECRET'];
  const googleOAuth =
    typeof googleClientId === 'string' && googleClientId.length > 0 &&
    typeof googleClientSecret === 'string' && googleClientSecret.length > 0
      ? {
          clientId: googleClientId,
          clientSecret: googleClientSecret,
          backendUrl: process.env['BACKEND_URL'] ?? 'http://localhost:3000',
          frontendUrl: process.env['FRONTEND_URL'] ?? 'http://localhost:5173',
        }
      : undefined;

  const notionTokenEncKey = process.env['NOTION_TOKEN_ENC_KEY'];
  const notionEncKey = typeof notionTokenEncKey === 'string' && notionTokenEncKey.length > 0
    ? notionTokenEncKey
    : undefined;
  const notionRepo: NotionConnectionRepository = pool !== undefined
    ? new PgNotionConnectionRepository(pool, notionEncKey)
    : new InMemoryNotionConnectionRepository();
  if (pool !== undefined && notionEncKey === undefined) {
    console.warn('[compose] NOTION_TOKEN_ENC_KEY 미설정 — 노션 토큰이 평문으로 저장됩니다. 운영에서는 설정을 권장합니다.');
  }
  const notion = { repo: notionRepo };

  const corsOrigin = process.env['CORS_ORIGIN'];
  const diarySummarizer = new DiarySummarizer({ gateway: bound as unknown as SummaryAIGateway });
  const app = createApp({
    jwtSecret,
    auth: authApi,
    session: sessionApi,
    diaries: diaryQuery,
    summarizer: diarySummarizer,
    googleOAuth,
    notion,
    availableModels,
    admin: adminApi,
    ...(typeof corsOrigin === 'string' && corsOrigin.length > 0 ? { corsOrigin } : {}),
  });

  const hub = new SessionEventHub();
  registerSse(app, { jwtSecret, hub });
  const server = createServer(app);
  attachWebSocket(server, { jwtSecret, hub });

  const aiProvider = usingGemini ? 'gemini' : usingOpenAi ? 'openai' : 'fake';
  return { app, server, hub, usingRealOpenAi, aiProvider };
}
