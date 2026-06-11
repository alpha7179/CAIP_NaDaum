// API 요청/응답 타입 정의
import type {
  CalibratedEmotion,
  ConversationStage,
  CounselingReferral,
  DiaryEntry,
  EmergencyContact,
  EmotionScores,
  RiskLevel,
} from '@nadaum/shared';

export interface ConsentItemsDto {
  privacyPolicy: boolean;
  nonMedicalDisclaimer: boolean;
  guardianNotification: boolean;
}

export interface GuardianDto {
  relationship?: string;
  name: string;
  email: string;
  phone: string;
  emailEnabled: boolean;
  smsEnabled: boolean;
}

export interface GuardiansResponse {
  guardians: GuardianDto[];
}

export interface NotificationPreferences {
  emailEnabled: boolean;
  smsEnabled: boolean;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name?: string;
  consentItems: ConsentItemsDto;
  guardians?: GuardianDto[];
}

export interface AuthResponse {
  userId: string;
  token: string;
  isAdmin?: boolean;
  name?: string;
  email?: string;
}

export interface UserSummary {
  userId: string;
  email: string;
  name?: string;
  isAdmin: boolean;
  createdAt: string;
  assignedModel?: string;
  photoUrl?: string;
}

export interface AdminUsersResponse {
  users: UserSummary[];
}

export interface AdminDiaryPage {
  items: DiaryEntry[];
  hasNext: boolean;
}

export interface StartSessionResponse {
  sessionId: string;
  stage: ConversationStage;
  model: string;
}

export interface AvailableModel {
  id: string;
  label: string;
  description: string;
  provider: string;
}

export interface ModelsResponse {
  models: AvailableModel[];
}

export type UtteranceRequest =
  | { text: string }
  | {
      audioBase64: string;
      contentType: 'audio/webm;codecs=opus' | 'audio/mp4;codecs=mp4a.40.2';
      sampleRate: 16000;
      channels: 1;
      durationSec: number;
    };

export interface UtteranceResponse {
  ok: true;
  transcript: string;
  aiResponse: string;
  emotion: CalibratedEmotion;
  riskLevel: RiskLevel;
  perSignal: Array<{ signalId: string; level: RiskLevel }>;
  stage: ConversationStage;
  forceFinalize: boolean;
  dialogueDegraded: boolean;
}

export interface SessionEndResponse {
  reason: 'user' | 'silence' | 'high_risk' | 'error';
  finalRiskLevel: RiskLevel;
  artifactCount: number;
}

export interface DiaryListResponse {
  items: DiaryEntry[];
  page: number;
  hasNext: boolean;
}

export interface EmotionTrendPoint {
  diaryId: string;
  sessionDate: string;
  scores: EmotionScores;
}

export interface EmotionTrendResponse {
  points: EmotionTrendPoint[];
}

export interface MentalHealthResourcesResponse {
  emergencyContacts: EmergencyContact[];
  counselingReferrals: CounselingReferral[];
}

export interface NotionStatus {
  connected: boolean;
  workspaceName?: string;
  targetPageTitle?: string;
  hasTarget?: boolean;
}

export class ApiError extends Error {
  public readonly status: number;
  public readonly code: string | undefined;
  public constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}
