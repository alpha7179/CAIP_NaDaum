// 산출물 생성기 등록·실행 도메인 컴포넌트

import type {
  AccessPolicy,
  ArtifactProducer,
  ConsentSnapshot,
  ProducedArtifact,
} from './ArtifactProducer.js';
import type { SessionResult } from './SessionResult.js';

export interface ArtifactProducerRegistryOptions {
  idFactory: () => string;
  clock?: () => Date;
}

// 산출물 생성기 등록 및 실행 레지스트리
export class ArtifactProducerRegistry {
  private readonly producers: Array<ArtifactProducer<unknown>> = [];
  private readonly idFactory: () => string;
  private readonly clock: () => Date;

  constructor(options: ArtifactProducerRegistryOptions) {
    this.idFactory = options.idFactory;
    this.clock = options.clock ?? (() => new Date());
  }

  register<T>(producer: ArtifactProducer<T>): void {
    const duplicate = this.producers.find(
      (p) => p.artifactType === producer.artifactType,
    );
    if (duplicate !== undefined) {
      throw new Error(
        `ArtifactProducer with artifactType='${producer.artifactType}' is already registered`,
      );
    }
    this.producers.push(producer as ArtifactProducer<unknown>);
  }

  async produceAll(
    session: SessionResult,
    consents: ConsentSnapshot,
  ): Promise<ProducedArtifact[]> {
    const results: ProducedArtifact[] = [];
    for (const producer of this.producers) {
      if (!this.isConsentGranted(producer, consents)) {
        continue;
      }
      const payload = await producer.produce(session);
      results.push({
        artifactType: producer.artifactType,
        artifactId: this.idFactory(),
        ownerUserId: session.userId,
        accessPolicy: defaultAccessPolicy(),
        payload,
        createdAt: this.clock(),
      });
    }
    return results;
  }

  private isConsentGranted(
    producer: ArtifactProducer<unknown>,
    consents: ConsentSnapshot,
  ): boolean {
    if (producer.requiresConsent === undefined) {
      return true;
    }
    return consents.granted[producer.requiresConsent] === true;
  }
}

function defaultAccessPolicy(): AccessPolicy {
  return { owner: 'user', share: [] };
}
