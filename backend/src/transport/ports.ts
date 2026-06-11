// 트랜스포트 계층 포트 — 사용자 대면 API가 의존하는 애플리케이션 서비스 계약

import type { DiaryEntry } from '@nadaum/shared';

import type {
  EndReason,
  HandleUtteranceResult,
  UtteranceInput,
} from '../domain/session/SessionOrchestrator.js';

// 회원가입 요청 본문
export interface RegisterBody {
  readonly email: string;
  readonly password: string;
  readonly name?: string;
  readonly consentItems: {
    readonly privacyPolicy: boolean;
    readonly nonMedicalDisclaimer: boolean;
    readonly guardianNotification: boolean;
  };
  readonly guardians?: ReadonlyArray<{
    readonly name: string;
    readonly email: string;
    readonly phone: string;
  }>;
}

// 로그인 요청 본문
export interface LoginBody {
  readonly email: string;
  readonly password: string;
}

// 인증 결과(사용자 식별자 + Bearer 토큰)
export interface AuthResult {
  readonly userId: string;
  readonly token: string;
  readonly isAdmin?: boolean;
  readonly name?: string;
}

// 관리자용 사용자 요약
export interface UserSummary {
  readonly userId: string;
  readonly email: string;
  readonly name?: string;
  readonly isAdmin: boolean;
  readonly createdAt: string;
  readonly assignedModel?: string;
  readonly photoUrl?: string;
}

// 관리자 API 포트
export interface AdminApi {
  listUsers(): Promise<UserSummary[]>;
  deleteUser(userId: string): Promise<void>;
  setAdmin(userId: string, isAdmin: boolean): Promise<void>;
  getUserDiaries(userId: string, page: number): Promise<{ items: DiaryEntry[]; hasNext: boolean }>;
  setUserModel(userId: string, modelId: string | undefined): Promise<void>;
  getUserModel(userId: string): Promise<string | undefined>;
}

// 인증·동의 API 포트
export interface AuthApi {
  register(body: RegisterBody): Promise<AuthResult>;
  isEmailAvailable(email: string): Promise<boolean>;
  login(body: LoginBody): Promise<AuthResult | undefined>;
  loginWithGoogle(googleId: string, email: string, name: string, photoUrl?: string): Promise<AuthResult>;
  changePassword(userId: string, currentPassword: string, newPassword: string): Promise<boolean>;
  withdrawConsent(userId: string, items: string[]): Promise<void>;
  deleteAccount(userId: string): Promise<void>;
  getNotificationPreferences(userId: string): Promise<NotificationPreferences>;
  setNotificationPreferences(
    userId: string,
    prefs: Partial<NotificationPreferences>,
  ): Promise<void>;
  getGuardians(userId: string): Promise<GuardianDto[]>;
  setGuardians(userId: string, guardians: GuardianDto[]): Promise<void>;
}

// 보호자 연락처 DTO (트랜스포트 표현)
export interface GuardianDto {
  readonly relationship?: string;
  readonly name: string;
  readonly email: string;
  readonly phone: string;
  readonly emailEnabled: boolean;
  readonly smsEnabled: boolean;
}

// 사용자별 보호자 안전 알림 채널 활성화 설정
export interface NotificationPreferences {
  readonly emailEnabled: boolean;
  readonly smsEnabled: boolean;
}

// 세션 시작 결과
export interface SessionStartResult {
  readonly sessionId: string;
  readonly stage: string;
  readonly model: string;
}

// 세션 종료 결과(트랜스포트 노출 형태)
export interface SessionEndResult {
  readonly reason: EndReason;
  readonly finalRiskLevel: string;
  readonly artifactCount: number;
}

// 선택 가능한 AI 모델 정보
export interface AvailableModel {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly provider: string;
}

// 세션 라이프사이클 API 포트(SessionOrchestrator 어댑팅)
export interface SessionApi {
  start(userId: string, model?: string, isAdmin?: boolean): Promise<SessionStartResult>;
  handleUtterance(
    userId: string,
    sessionId: string,
    input: UtteranceInput,
  ): Promise<HandleUtteranceResult>;
  end(userId: string, sessionId: string, reason: EndReason): Promise<SessionEndResult>;
}
