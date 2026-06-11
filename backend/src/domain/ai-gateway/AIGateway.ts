// 외부 AI 호출 단일 진입점 도메인 서비스
import type {
  DeidentificationHook,
  ExternalAITarget,
  HookContext,
  HookProcessResult,
} from './DeidentificationHook.js';

export type { ExternalAITarget } from './DeidentificationHook.js';

export interface ExternalAIRequest {
  readonly text?: string;
  readonly [key: string]: unknown;
}

// 게이트웨이가 어댑터에 전달하는 처리된 요청
export interface ProcessedExternalAIRequest<TReq extends ExternalAIRequest = ExternalAIRequest> {
  readonly text: string;
  readonly context: HookContext;
  readonly hookResult: HookProcessResult;
  readonly raw: TReq;
}

export interface ExternalAdapter<TReq extends ExternalAIRequest = ExternalAIRequest, TRes = unknown> {
  invoke(processed: ProcessedExternalAIRequest<TReq>): Promise<TRes>;
}

export interface AIGatewayCallMeta {
  readonly target: ExternalAITarget;
  readonly hookId: string;
  readonly maskedTokenCount: number;
  readonly piiCategories: readonly string[];
  readonly latencyMs: {
    readonly hook: number;
    readonly adapter: number;
    readonly total: number;
  };
}

export interface AIGatewayCallResult<TRes> {
  readonly response: TRes;
  readonly meta: AIGatewayCallMeta;
}

export interface AIGatewayStats {
  readonly callCount: number;
  readonly hookApplyCount: number;
  readonly externalInvokeCount: number;
}

// 비식별화 훅 처리 오류로 외부 AI 호출이 차단됨을 나타내는 예외
export class ExternalAIBlockedError extends Error {
  public readonly target: ExternalAITarget;
  public readonly hookId: string;
  public readonly cause: unknown;

  public constructor(target: ExternalAITarget, hookId: string, cause: unknown) {
    const message =
      cause instanceof Error
        ? `External AI call to '${target}' blocked by deidentification hook '${hookId}': ${cause.message}`
        : `External AI call to '${target}' blocked by deidentification hook '${hookId}'.`;
    super(message);
    this.name = 'ExternalAIBlockedError';
    this.target = target;
    this.hookId = hookId;
    this.cause = cause;
  }
}

export interface AIGatewayAuditLogger {
  logHookFailure(event: {
    readonly target: ExternalAITarget;
    readonly hookId: string;
    readonly userId: string;
    readonly sessionId?: string;
    readonly errorMessage: string;
    readonly occurredAt: Date;
  }): void | Promise<void>;
}

// AIGateway 도메인 인터페이스
export interface AIGateway {
  setHook(hook: DeidentificationHook): void;

  getHookId(): string;

  registerAdapter<TReq extends ExternalAIRequest, TRes>(
    target: ExternalAITarget,
    adapter: ExternalAdapter<TReq, TRes>,
  ): void;

  callExternalAI<TReq extends ExternalAIRequest, TRes>(
    target: ExternalAITarget,
    req: TReq,
    context: HookContext,
  ): Promise<AIGatewayCallResult<TRes>>;

  getCallStats(): AIGatewayStats;

  resetCallStats(): void;
}

function nowMs(): number {
  return performance.now();
}

// AIGateway 표준 구현체
export class AIGatewayImpl implements AIGateway {
  private hook: DeidentificationHook;
  private readonly adapters: Map<ExternalAITarget, ExternalAdapter<ExternalAIRequest, unknown>>;
  private readonly auditLogger: AIGatewayAuditLogger | undefined;

  private callCount = 0;
  private hookApplyCount = 0;
  private externalInvokeCount = 0;

  public constructor(initialHook: DeidentificationHook, auditLogger?: AIGatewayAuditLogger) {
    this.hook = initialHook;
    this.adapters = new Map();
    this.auditLogger = auditLogger;
  }

  public setHook(hook: DeidentificationHook): void {
    this.hook = hook;
  }

  public getHookId(): string {
    return this.hook.hookId;
  }

  public registerAdapter<TReq extends ExternalAIRequest, TRes>(
    target: ExternalAITarget,
    adapter: ExternalAdapter<TReq, TRes>,
  ): void {
    this.adapters.set(target, adapter as unknown as ExternalAdapter<ExternalAIRequest, unknown>);
  }

  public async callExternalAI<TReq extends ExternalAIRequest, TRes>(
    target: ExternalAITarget,
    req: TReq,
    context: HookContext,
  ): Promise<AIGatewayCallResult<TRes>> {
    this.callCount += 1;
    const totalStart = nowMs();

    const normalizedContext: HookContext = { ...context, callTarget: target };

    const hookInputText = typeof req.text === 'string' ? req.text : '';
    const hookStart = nowMs();
    let hookResult: HookProcessResult;
    try {
      hookResult = await this.hook.process({ text: hookInputText, context: normalizedContext });
    } catch (err) {
      const hookId = this.hook.hookId;
      try {
        const audit = this.auditLogger?.logHookFailure({
          target,
          hookId,
          userId: normalizedContext.userId,
          ...(normalizedContext.sessionId !== undefined
            ? { sessionId: normalizedContext.sessionId }
            : {}),
          errorMessage: err instanceof Error ? err.message : String(err),
          occurredAt: new Date(),
        });
        if (audit !== undefined && typeof (audit).then === 'function') {
          (audit).catch(() => undefined);
        }
      } catch {
        /* noop */
      }
      throw new ExternalAIBlockedError(target, hookId, err);
    }
    const hookLatency = Math.max(0, nowMs() - hookStart);
    this.hookApplyCount += 1;

    const adapter = this.adapters.get(target) as
      | ExternalAdapter<TReq, TRes>
      | undefined;
    if (adapter === undefined) {
      throw new Error(`No adapter registered for ExternalAITarget '${target}'.`);
    }

    const processed: ProcessedExternalAIRequest<TReq> = {
      text: hookResult.text,
      context: normalizedContext,
      hookResult,
      raw: req,
    };

    const adapterStart = nowMs();
    this.externalInvokeCount += 1;
    const response = await adapter.invoke(processed);
    const adapterLatency = Math.max(0, nowMs() - adapterStart);

    const totalLatency = Math.max(0, nowMs() - totalStart);

    const meta: AIGatewayCallMeta = {
      target,
      hookId: this.hook.hookId,
      maskedTokenCount: hookResult.tokenMappings.length,
      piiCategories: hookResult.detectedPiiCategories,
      latencyMs: {
        hook: hookLatency,
        adapter: adapterLatency,
        total: totalLatency,
      },
    };

    return { response, meta };
  }

  public getCallStats(): AIGatewayStats {
    return {
      callCount: this.callCount,
      hookApplyCount: this.hookApplyCount,
      externalInvokeCount: this.externalInvokeCount,
    };
  }

  public resetCallStats(): void {
    this.callCount = 0;
    this.hookApplyCount = 0;
    this.externalInvokeCount = 0;
  }
}
