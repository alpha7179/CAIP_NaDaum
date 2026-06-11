// 보호 대상 슈퍼관리자(시드 관리자) 가드

export function getProtectedAdminEmail(): string {
  return process.env['ADMIN_EMAIL'] ?? 'admin@nadaum.ai';
}

export function isProtectedAdminEmail(email: string | null | undefined): boolean {
  if (email === null || email === undefined) return false;
  return email === getProtectedAdminEmail();
}

// 보호 대상 슈퍼관리자에 대한 삭제/강등 시도 시 발생하는 오류
export class ProtectedAdminError extends Error {
  public readonly code = 'protected_admin' as const;

  public constructor(message = '시스템 관리자 계정은 삭제하거나 권한을 회수할 수 없습니다.') {
    super(message);
    this.name = 'ProtectedAdminError';
  }
}
