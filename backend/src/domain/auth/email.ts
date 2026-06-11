// 이메일 형식 검증

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmailFormat(email: unknown): boolean {
  if (typeof email !== 'string') return false;
  return EMAIL_REGEX.test(email);
}
