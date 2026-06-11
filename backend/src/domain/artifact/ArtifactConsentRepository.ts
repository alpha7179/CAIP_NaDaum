// 산출물별 동의 영속화 포트 인터페이스

export interface ArtifactConsentRecord {
  userId: string;
  artifactType: string;
  granted: boolean;
  grantedAt: Date;
  revokedAt?: Date;
}

export interface ConsentSnapshot {
  userId: string;
  granted: Record<string, boolean>;
}

// 산출물 동의 저장소 포트
export interface ArtifactConsentRepository {
  grant(userId: string, artifactType: string, at?: Date): Promise<void>;

  revoke(userId: string, artifactType: string, at?: Date): Promise<void>;

  findByUser(userId: string): Promise<ArtifactConsentRecord[]>;

  getSnapshot(userId: string): Promise<ConsentSnapshot>;
}
