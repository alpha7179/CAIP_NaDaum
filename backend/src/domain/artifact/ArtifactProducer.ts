// ArtifactProducer 인터페이스 및 메타데이터 타입

import type { SessionResult } from './SessionResult.js';

export interface AccessPolicy {
  owner: 'user' | 'system';
  share: string[];
}

export interface ConsentSnapshot {
  userId: string;
  granted: Record<string, boolean>;
}

export interface ProducedArtifact {
  artifactType: string;
  artifactId: string;
  ownerUserId: string;
  recipients?: string[];
  accessPolicy: AccessPolicy;
  payload: unknown;
  createdAt: Date;
}

// 산출물 생성기 인터페이스
export interface ArtifactProducer<T = unknown> {
  readonly artifactType: string;
  readonly requiresConsent?: string;
  produce(session: SessionResult): Promise<T>;
}
