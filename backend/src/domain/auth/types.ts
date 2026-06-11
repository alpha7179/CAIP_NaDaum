// Auth & Consent 도메인 타입

export type UserId = string;

export type ConsentId = string;

export type GuardianId = string;

export interface ConsentItems {
  privacyPolicy: boolean;
  nonMedicalDisclaimer: boolean;
  guardianNotification: boolean;
}

export type ConsentItemKey = keyof ConsentItems;

export const CONSENT_ITEM_KEYS = [
  'privacyPolicy',
  'nonMedicalDisclaimer',
  'guardianNotification',
] as const satisfies ReadonlyArray<ConsentItemKey>;

export const REQUIRED_CONSENT_ITEM_KEYS = [
  'privacyPolicy',
  'nonMedicalDisclaimer',
  'guardianNotification',
] as const satisfies ReadonlyArray<ConsentItemKey>;

export const WITHDRAWABLE_CONSENT_ITEM_KEYS = [
  'privacyPolicy',
  'nonMedicalDisclaimer',
] as const satisfies ReadonlyArray<ConsentItemKey>;

export interface ConsentRecord {
  consentId: ConsentId;
  userId: UserId;
  consentItems: ConsentItems;
  grantedAt: Date;
  withdrawnAt?: Date;
}

export interface GuardianContact {
  guardianId: GuardianId;
  userId: UserId;
  relationship?: string;
  name: string;
  email: string;
  phone: string;
  emailEnabled: boolean;
  smsEnabled: boolean;
  createdAt: Date;
}

export interface GuardianContactInput {
  relationship?: string;
  name: string;
  email: string;
  phone: string;
  emailEnabled?: boolean;
  smsEnabled?: boolean;
}

export interface RegisterUserInput {
  email: string;
  passwordHash: string;
  name?: string;
  consentItems: ConsentItems;
  guardians: GuardianContactInput[];
}

export interface RegisterUserResult {
  userId: UserId;
  consentId: ConsentId;
  guardianIds: GuardianId[];
}

export type EligibilityResult =
  | { eligible: true }
  | { eligible: false; reason: 'consent_missing' | 'consent_withdrawn' };

export type AuthErrorCode =
  | 'invalid_email_format'
  | 'invalid_phone_format'
  | 'too_many_guardians'
  | 'consent_missing'
  | 'email_taken';

// 도메인 검증 실패 오류
export class AuthValidationError extends Error {
  public readonly code: AuthErrorCode;
  public readonly details?: Record<string, unknown>;

  public constructor(
    code: AuthErrorCode,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AuthValidationError';
    this.code = code;
    if (details !== undefined) {
      this.details = details;
    }
  }
}
