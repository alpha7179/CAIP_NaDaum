// Auth & Consent 도메인 배럴 export

export { AuthService, MAX_GUARDIANS } from './AuthService.js';
export type { AuthServiceOptions } from './AuthService.js';

export {
  EMAIL_REGEX,
  validateEmailFormat,
} from './email.js';

export {
  E164_PHONE_REGEX,
  validatePhoneFormat,
} from './phone.js';

export {
  AuthValidationError,
  CONSENT_ITEM_KEYS,
  REQUIRED_CONSENT_ITEM_KEYS,
} from './types.js';
export type {
  AuthErrorCode,
  ConsentId,
  ConsentItemKey,
  ConsentItems,
  ConsentRecord,
  EligibilityResult,
  GuardianContact,
  GuardianContactInput,
  GuardianId,
  RegisterUserInput,
  RegisterUserResult,
  UserId,
} from './types.js';

export type {
  AuthServicePorts,
  ConsentItemEvaluator,
  ConsentRepository,
  GuardianRepository,
  TransactionContext,
  TransactionRunner,
  UserRepository,
} from './ports.js';
