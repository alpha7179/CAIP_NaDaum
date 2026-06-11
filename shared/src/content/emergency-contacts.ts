// 긴급 위기 상담 핫라인 정적 데이터

// 단일 긴급 위기 상담 자원 항목
export interface EmergencyContact {
  phone: string;
  name: string;
  description: string;
}

export const EMERGENCY_PHONE_NUMBERS = ['1393', '1577-0199'] as const;

export type EmergencyPhoneNumbers = typeof EMERGENCY_PHONE_NUMBERS;

export const EMERGENCY_CONTACTS = Object.freeze([
  Object.freeze({
    phone: '1393',
    name: '자살예방상담전화',
    description:
      '자살·자해 위기 상황에서 24시간 무료로 이용 가능한 전문 상담 핫라인입니다.',
  }),
  Object.freeze({
    phone: '1577-0199',
    name: '정신건강위기상담전화',
    description:
      '24시간 운영되는 정신건강 위기 상담 대표번호로, 거주 지역의 정신건강복지센터로 연결됩니다.',
  }),
]) as readonly [EmergencyContact, EmergencyContact];

if (
  EMERGENCY_CONTACTS.length !== EMERGENCY_PHONE_NUMBERS.length ||
  EMERGENCY_CONTACTS[0].phone !== EMERGENCY_PHONE_NUMBERS[0] ||
  EMERGENCY_CONTACTS[1].phone !== EMERGENCY_PHONE_NUMBERS[1]
) {
  throw new Error(
    '[emergency-contacts] EMERGENCY_CONTACTS와 EMERGENCY_PHONE_NUMBERS의 순서·값이 일치하지 않습니다.',
  );
}
