// 인증된 사용자만 접근 허용하는 라우트 가드
import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';

import { useAuth } from '../auth/AuthContext';

export function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
