// 국제 전화번호(E.164) 형식 검증

export const E164_PHONE_REGEX = /^\+[1-9]\d{1,14}$/;

export function validatePhoneFormat(phone: unknown): boolean {
  if (typeof phone !== 'string') return false;
  return E164_PHONE_REGEX.test(phone);
}
