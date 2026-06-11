// SessionRepository 도메인 포트
import type { SessionContext } from '@nadaum/shared';

// 세션 상태 저장소 포트
export interface SessionRepository {
  getSession(sessionId: string): Promise<SessionContext | undefined>;

  saveSession(context: SessionContext): Promise<void>;

  deleteSession(sessionId: string): Promise<void>;
}
