// Auth & Consent 저장소 포트 (의존성 역전 인터페이스)

import type {
  ConsentId,
  ConsentItemKey,
  ConsentItems,
  ConsentRecord,
  GuardianContact,
  UserId,
} from './types.js';

export interface TransactionRunner {
  run<T>(work: (tx: TransactionContext) => Promise<T>): Promise<T>;
}

export interface TransactionContext {
  readonly _brand: 'transaction-context';
}

export interface UserRepository {
  create(
    input: { userId: UserId; email: string; passwordHash: string; name?: string; createdAt: Date },
    tx?: TransactionContext,
  ): Promise<void>;

  existsById(userId: UserId): Promise<boolean>;
}

export interface ConsentRepository {
  create(record: ConsentRecord, tx?: TransactionContext): Promise<void>;

  findLatestByUserId(userId: UserId): Promise<ConsentRecord | undefined>;

  withdraw(
    input: {
      consentId: ConsentId;
      userId: UserId;
      items: ConsentItemKey[];
      at: Date;
    },
    tx?: TransactionContext,
  ): Promise<void>;
}

export interface GuardianRepository {
  createMany(
    contacts: GuardianContact[],
    tx?: TransactionContext,
  ): Promise<void>;

  replaceAll(
    userId: UserId,
    contacts: GuardianContact[],
    tx?: TransactionContext,
  ): Promise<void>;

  listByUserId(userId: UserId): Promise<GuardianContact[]>;
}

export interface AuthServicePorts {
  users: UserRepository;
  consents: ConsentRepository;
  guardians: GuardianRepository;
  transactions: TransactionRunner;
}

export type ConsentItemEvaluator = (items: ConsentItems) => ConsentItemKey[];
