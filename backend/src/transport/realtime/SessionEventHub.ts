// SessionEventHub — 세션별 실시간 이벤트 인메모리 pub/sub

export type SessionEventType = 'stt' | 'ai_response' | 'risk' | 'stage' | 'ended';

export interface SessionEvent {
  readonly type: SessionEventType;
  readonly sessionId: string;
  readonly payload: unknown;
  readonly at: string;
}

export type Unsubscribe = () => void;

type Listener = (event: SessionEvent) => void;

export class SessionEventHub {
  private readonly listeners = new Map<string, Set<Listener>>();

  public subscribe(sessionId: string, listener: Listener): Unsubscribe {
    let set = this.listeners.get(sessionId);
    if (set === undefined) {
      set = new Set();
      this.listeners.set(sessionId, set);
    }
    set.add(listener);
    return () => {
      const current = this.listeners.get(sessionId);
      if (current === undefined) {
        return;
      }
      current.delete(listener);
      if (current.size === 0) {
        this.listeners.delete(sessionId);
      }
    };
  }

  public publish(
    sessionId: string,
    type: SessionEventType,
    payload: unknown,
    at: Date = new Date(),
  ): void {
    const set = this.listeners.get(sessionId);
    if (set === undefined) {
      return;
    }
    const event: SessionEvent = { type, sessionId, payload, at: at.toISOString() };
    for (const listener of [...set]) {
      try {
        listener(event);
      } catch {}
    }
  }

  public subscriberCount(sessionId: string): number {
    return this.listeners.get(sessionId)?.size ?? 0;
  }
}
