// ArtifactConsentRepository (인메모리) 단위 테스트
import { describe, expect, it } from 'vitest';

import { InMemoryArtifactConsentRepository } from './ArtifactConsentRepository.js';

const userA = '11111111-1111-1111-1111-111111111111';
const userB = '22222222-2222-2222-2222-222222222222';

describe('InMemoryArtifactConsentRepository', () => {
  describe('grant', () => {
    it('신규 사용자에 대해 active 레코드를 생성한다', async () => {
      const repo = new InMemoryArtifactConsentRepository();
      const at = new Date('2025-01-15T10:00:00Z');

      await repo.grant(userA, 'emotion_diary', at);

      const records = await repo.findByUser(userA);
      expect(records).toHaveLength(1);
      expect(records[0]).toEqual({
        userId: userA,
        artifactType: 'emotion_diary',
        granted: true,
        grantedAt: at,
      });
      expect(records[0].revokedAt).toBeUndefined();
    });

    it('동일 (userId, artifactType)에 대한 grant는 멱등하며 grantedAt을 갱신한다', async () => {
      const repo = new InMemoryArtifactConsentRepository();
      const first = new Date('2025-01-15T10:00:00Z');
      const second = new Date('2025-01-16T11:00:00Z');

      await repo.grant(userA, 'emotion_diary', first);
      await repo.grant(userA, 'emotion_diary', second);

      const records = await repo.findByUser(userA);
      expect(records).toHaveLength(1);
      expect(records[0].granted).toBe(true);
      expect(records[0].grantedAt).toEqual(second);
      expect(records[0].revokedAt).toBeUndefined();
    });

    it('철회 후 재부여 시 활성 상태로 복귀하고 revokedAt이 초기화된다', async () => {
      const repo = new InMemoryArtifactConsentRepository();
      const grantedAt = new Date('2025-01-15T10:00:00Z');
      const revokedAt = new Date('2025-01-15T12:00:00Z');
      const regrantedAt = new Date('2025-01-16T09:00:00Z');

      await repo.grant(userA, 'emotion_diary', grantedAt);
      await repo.revoke(userA, 'emotion_diary', revokedAt);
      await repo.grant(userA, 'emotion_diary', regrantedAt);

      const records = await repo.findByUser(userA);
      expect(records).toHaveLength(1);
      expect(records[0].granted).toBe(true);
      expect(records[0].grantedAt).toEqual(regrantedAt);
      expect(records[0].revokedAt).toBeUndefined();
    });
  });

  describe('revoke', () => {
    it('활성 동의를 철회 상태로 갱신하고 revokedAt을 기록한다', async () => {
      const repo = new InMemoryArtifactConsentRepository();
      const grantedAt = new Date('2025-01-15T10:00:00Z');
      const revokedAt = new Date('2025-01-15T12:00:00Z');

      await repo.grant(userA, 'emotion_diary', grantedAt);
      await repo.revoke(userA, 'emotion_diary', revokedAt);

      const records = await repo.findByUser(userA);
      expect(records).toHaveLength(1);
      expect(records[0].granted).toBe(false);
      expect(records[0].grantedAt).toEqual(grantedAt);
      expect(records[0].revokedAt).toEqual(revokedAt);
    });

    it('부여된 적 없는 (userId, artifactType)에 대한 revoke는 NO-OP이다', async () => {
      const repo = new InMemoryArtifactConsentRepository();

      await repo.revoke(userA, 'emotion_diary', new Date());

      const records = await repo.findByUser(userA);
      expect(records).toHaveLength(0);
    });

    it('이미 철회된 동의에 대한 revoke는 멱등하며 revokedAt을 가장 최근 시각으로 갱신한다', async () => {
      const repo = new InMemoryArtifactConsentRepository();
      const grantedAt = new Date('2025-01-15T10:00:00Z');
      const firstRevoke = new Date('2025-01-15T12:00:00Z');
      const secondRevoke = new Date('2025-01-15T14:00:00Z');

      await repo.grant(userA, 'emotion_diary', grantedAt);
      await repo.revoke(userA, 'emotion_diary', firstRevoke);
      await repo.revoke(userA, 'emotion_diary', secondRevoke);

      const records = await repo.findByUser(userA);
      expect(records).toHaveLength(1);
      expect(records[0].granted).toBe(false);
      expect(records[0].revokedAt).toEqual(secondRevoke);
    });
  });

  describe('getSnapshot', () => {
    it('활성 동의는 granted=true로 노출된다', async () => {
      const repo = new InMemoryArtifactConsentRepository();
      await repo.grant(userA, 'emotion_diary');

      const snapshot = await repo.getSnapshot(userA);

      expect(snapshot.userId).toBe(userA);
      expect(snapshot.granted.emotion_diary).toBe(true);
    });

    it('철회된 동의는 granted=false로 노출된다 (다운스트림은 키 부재와 동등 취급)', async () => {
      const repo = new InMemoryArtifactConsentRepository();
      await repo.grant(userA, 'emotion_diary');
      await repo.revoke(userA, 'emotion_diary');

      const snapshot = await repo.getSnapshot(userA);

      expect(snapshot.granted.emotion_diary).toBe(false);
    });

    it('레코드가 없는 사용자는 빈 granted 맵을 반환한다', async () => {
      const repo = new InMemoryArtifactConsentRepository();

      const snapshot = await repo.getSnapshot(userA);

      expect(snapshot).toEqual({ userId: userA, granted: {} });
    });

    it('Phase 2 호환: 다중 artifactType을 단절 없이 노출한다', async () => {
      const repo = new InMemoryArtifactConsentRepository();
      await repo.grant(userA, 'emotion_diary');
      await repo.grant(userA, 'counselor_report');
      await repo.grant(userA, 'self_assessment');
      await repo.revoke(userA, 'self_assessment');

      const snapshot = await repo.getSnapshot(userA);

      expect(snapshot.granted).toEqual({
        emotion_diary: true,
        counselor_report: true,
        self_assessment: false,
      });
    });
  });

  describe('findByUser', () => {
    it('다른 사용자의 동의는 노출되지 않는다 (사용자 격리)', async () => {
      const repo = new InMemoryArtifactConsentRepository();
      await repo.grant(userA, 'emotion_diary');
      await repo.grant(userB, 'emotion_diary');
      await repo.grant(userB, 'counselor_report');

      const recordsA = await repo.findByUser(userA);
      const recordsB = await repo.findByUser(userB);

      expect(recordsA).toHaveLength(1);
      expect(recordsA[0].userId).toBe(userA);
      expect(recordsB).toHaveLength(2);
      expect(recordsB.every((r) => r.userId === userB)).toBe(true);
    });

    it('artifactType 사전순으로 결정적 정렬되어 반환된다', async () => {
      const repo = new InMemoryArtifactConsentRepository();
      await repo.grant(userA, 'self_assessment');
      await repo.grant(userA, 'emotion_diary');
      await repo.grant(userA, 'counselor_report');

      const records = await repo.findByUser(userA);

      expect(records.map((r) => r.artifactType)).toEqual([
        'counselor_report',
        'emotion_diary',
        'self_assessment',
      ]);
    });
  });

  describe('MVP 회원가입 시나리오', () => {
    it('회원가입 시 emotion_diary 동의 묵시적 부여를 시뮬레이션한다', async () => {
      const repo = new InMemoryArtifactConsentRepository();
      const registeredAt = new Date('2025-01-15T10:00:00Z');

      await repo.grant(userA, 'emotion_diary', registeredAt);

      const snapshot = await repo.getSnapshot(userA);
      expect(snapshot.granted.emotion_diary).toBe(true);
    });
  });
});
