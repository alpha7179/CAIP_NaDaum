// @nadaum/shared/content — 정적 콘텐츠 배럴 export

export {
  NON_MEDICAL_DISCLAIMER,
  NON_MEDICAL_DISCLAIMER_BODY,
  NON_MEDICAL_DISCLAIMER_CONSENT_KEY,
  NON_MEDICAL_DISCLAIMER_PARAGRAPHS,
  NON_MEDICAL_DISCLAIMER_TITLE,
} from './non-medical-disclaimer.js';
export type {
  NonMedicalDisclaimer,
  NonMedicalDisclaimerConsentKey,
} from './non-medical-disclaimer.js';

export { DAILY_TIPS, tipsForEmotion } from './daily-tips.js';
export type { DailyTip } from './daily-tips.js';

export { COUNSELING_REFERRALS, findCounselingReferral } from './counseling-referrals.js';
export type { CounselingReferral } from './counseling-referrals.js';

export {
  EMERGENCY_CONTACTS,
  EMERGENCY_PHONE_NUMBERS,
} from './emergency-contacts.js';
export type {
  EmergencyContact,
  EmergencyPhoneNumbers,
} from './emergency-contacts.js';
