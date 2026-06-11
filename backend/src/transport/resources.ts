// 전문 정신건강 자원 메타데이터

import {
  COUNSELING_REFERRALS,
  EMERGENCY_CONTACTS,
  type CounselingReferral,
  type EmergencyContact,
} from '@nadaum/shared';

export interface MentalHealthResources {
  readonly emergencyContacts: readonly EmergencyContact[];
  readonly counselingReferrals: readonly CounselingReferral[];
}

export function getMentalHealthResources(): MentalHealthResources {
  return {
    emergencyContacts: EMERGENCY_CONTACTS,
    counselingReferrals: COUNSELING_REFERRALS,
  };
}
