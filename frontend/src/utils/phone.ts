// 전화번호 포맷 유틸 (숫자 추출 → 010-XXXX-XXXX)

export const PHONE_RE = /^010-\d{4}-\d{4}$/;

export function formatPhone(input: string): string {
  const digits = input.replace(/\D/g, '').slice(0, 11);
  if (digits.length < 4) return digits;
  if (digits.length < 8) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

export function toE164(local: string): string {
  const digits = local.replace(/\D/g, '');
  if (!/^010\d{8}$/.test(digits)) return '';
  return `+82${digits.slice(1)}`;
}

export function fromE164(e164: string): string {
  const m = /^\+82(\d{9,10})$/.exec(e164.trim());
  if (m && m[1] !== undefined) return formatPhone(`0${m[1]}`);
  return formatPhone(e164);
}
