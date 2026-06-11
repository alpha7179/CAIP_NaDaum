// Auth & Consent 도메인 서비스

import { randomUUID } from 'node:crypto';

import { validateEmailFormat as validateEmail } from './email.js';
import { validatePhoneFormat as validatePhone } from './phone.js';
import type {
  AuthServicePorts,
  TransactionContext,
} from './ports.js';
import {
  AuthValidationError,
  REQUIRED_CONSENT_ITEM_KEYS,
  WITHDRAWABLE_CONSENT_ITEM_KEYS,
  type ConsentItemKey,
  type ConsentItems,
  type ConsentRecord,
  type EligibilityResult,
  type GuardianContact,
  type GuardianContactInput,
  type GuardianId,
  type RegisterUserInput,
  type RegisterUserResult,
  type UserId,
} from './types.js';

export const MAX_GUARDIANS = 5;

export interface AuthServiceOptions {
  now?: () => Date;
  newId?: () => string;
}

export class AuthService {
  private readonly ports: AuthServicePorts;
  private readonly now: () => Date;
  private readonly newId: () => string;

  public constructor(ports: AuthServicePorts, options: AuthServiceOptions = {}) {
    this.ports = ports;
    this.now = options.now ?? (() => new Date());
    this.newId = options.newId ?? (() => randomUUID());
  }

  public validateEmailFormat(email: string): boolean {
    return validateEmail(email);
  }

  public validatePhoneFormat(phone: string): boolean {
    return validatePhone(phone);
  }

  public static validateGuardiansLimit(
    guardians: ReadonlyArray<GuardianContactInput>,
  ): void {
    if (guardians.length > MAX_GUARDIANS) {
      throw new AuthValidationError(
        'too_many_guardians',
        `Guardian count must be 0..${MAX_GUARDIANS}, got ${guardians.length}`,
        { count: guardians.length, max: MAX_GUARDIANS },
      );
    }
  }

  public static validateGuardianContacts(
    guardians: ReadonlyArray<GuardianContactInput>,
  ): void {
    for (let i = 0; i < guardians.length; i += 1) {
      const g = guardians[i];
      if (g === undefined || !validateEmail(g.email)) {
        throw new AuthValidationError(
          'invalid_email_format',
          `Guardian email at index ${i} is not a valid email address`,
          { index: i, email: g?.email },
        );
      }
      if (!validatePhone(g.phone)) {
        throw new AuthValidationError(
          'invalid_phone_format',
          `Guardian phone at index ${i} is not a valid E.164 phone number (e.g. +821012345678)`,
          { index: i, phone: g.phone },
        );
      }
    }
  }

  public static validateConsentItems(items: ConsentItems): void {
    const missing = AuthService.collectMissingConsents(items);
    if (missing.length > 0) {
      throw new AuthValidationError(
        'consent_missing',
        `Required consent items are missing: ${missing.join(', ')}`,
        { missing },
      );
    }
  }

  public static collectMissingConsents(items: ConsentItems): ConsentItemKey[] {
    return REQUIRED_CONSENT_ITEM_KEYS.filter((key) => items[key] !== true);
  }

  public static evaluateEligibility(
    record: ConsentRecord | undefined,
  ): EligibilityResult {
    if (record === undefined) {
      return { eligible: false, reason: 'consent_missing' };
    }
    if (record.withdrawnAt !== undefined) {
      return { eligible: false, reason: 'consent_withdrawn' };
    }
    const missing = AuthService.collectMissingConsents(record.consentItems);
    if (missing.length > 0) {
      return { eligible: false, reason: 'consent_missing' };
    }
    return { eligible: true };
  }

  public async registerUser(input: RegisterUserInput): Promise<RegisterUserResult> {
    AuthService.validateConsentItems(input.consentItems);
    AuthService.validateGuardiansLimit(input.guardians);
    AuthService.validateGuardianContacts(input.guardians);

    const now = this.now();
    const userId: UserId = this.newId();
    const consentId: string = this.newId();

    const consentRecord: ConsentRecord = {
      consentId,
      userId,
      consentItems: { ...input.consentItems },
      grantedAt: now,
    };

    const guardians: GuardianContact[] = input.guardians.map((g) =>
      this.buildGuardian(userId, g, now),
    );

    await this.ports.transactions.run(async (tx: TransactionContext) => {
      await this.ports.users.create(
        {
          userId,
          email: input.email,
          passwordHash: input.passwordHash,
          ...(input.name !== undefined ? { name: input.name } : {}),
          createdAt: now,
        },
        tx,
      );
      await this.ports.consents.create(consentRecord, tx);
      if (guardians.length > 0) {
        await this.ports.guardians.createMany(guardians, tx);
      }
    });

    return {
      userId,
      consentId,
      guardianIds: guardians.map((g) => g.guardianId),
    };
  }

  private buildGuardian(
    userId: UserId,
    g: GuardianContactInput,
    now: Date,
  ): GuardianContact {
    return {
      guardianId: this.newId(),
      userId,
      ...(g.relationship !== undefined && g.relationship.trim().length > 0
        ? { relationship: g.relationship.trim() }
        : {}),
      name: g.name,
      email: g.email,
      phone: g.phone,
      emailEnabled: g.emailEnabled ?? true,
      smsEnabled: g.smsEnabled ?? true,
      createdAt: now,
    };
  }

  public async replaceGuardians(
    userId: UserId,
    guardians: GuardianContactInput[],
  ): Promise<GuardianId[]> {
    AuthService.validateGuardiansLimit(guardians);
    AuthService.validateGuardianContacts(guardians);
    const now = this.now();
    const contacts = guardians.map((g) => this.buildGuardian(userId, g, now));
    await this.ports.transactions.run(async (tx: TransactionContext) => {
      await this.ports.guardians.replaceAll(userId, contacts, tx);
    });
    return contacts.map((c) => c.guardianId);
  }

  public async listGuardians(userId: UserId): Promise<GuardianContact[]> {
    return this.ports.guardians.listByUserId(userId);
  }

  public async withdrawConsent(
    userId: UserId,
    items: ConsentItemKey[],
  ): Promise<void> {
    const known = new Set<ConsentItemKey>(WITHDRAWABLE_CONSENT_ITEM_KEYS);
    const targets: ConsentItemKey[] =
      items.length === 0
        ? [...WITHDRAWABLE_CONSENT_ITEM_KEYS]
        : items.filter((k): k is ConsentItemKey => known.has(k));

    if (targets.length === 0) {
      return;
    }

    const at = this.now();

    await this.ports.transactions.run(async (tx: TransactionContext) => {
      await this.ports.consents.withdraw(
        {
          consentId: this.newId(),
          userId,
          items: targets,
          at,
        },
        tx,
      );
    });
  }

  public async isEligibleForSession(userId: UserId): Promise<EligibilityResult> {
    const latest = await this.ports.consents.findLatestByUserId(userId);
    return AuthService.evaluateEligibility(latest);
  }
}
