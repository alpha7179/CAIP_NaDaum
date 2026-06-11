// 위험 신호 합성 및 비대칭 전이 적용

import type { RiskLevel, RiskSignalSnapshot, RiskState } from '@nadaum/shared';

import { EmotionScoreSignal } from './EmotionScoreSignal.js';
import { KeywordSignal, type KeywordLookup, type KeywordMatchOptions } from './KeywordSignal.js';
import {
  decide as defaultDecide,
  type RiskDecisionFunction,
  defaultRiskDecisionFunction,
} from './RiskDecisionFunction.js';
import type { RiskInput, RiskSignal } from './RiskSignal.js';
import { SuicidalityModelSignal } from './SuicidalityModelSignal.js';

export const DOWNWARD_TRANSITION_THRESHOLD = 3;

// 단일 발화에 대한 위험 평가 결과
export interface UtteranceRiskAssessment {
  perSignal: Array<{ signalId: string; level: RiskLevel }>;
  combinedLevel: RiskLevel;
}

const RISK_WEIGHT: Readonly<Record<RiskLevel, number>> = Object.freeze({
  저위험: 0,
  중위험: 1,
  고위험: 2,
});

export function createInitialRiskState(now: Date = new Date()): RiskState {
  return {
    current: '저위험',
    consecutiveLowerCount: 0,
    lastEvaluatedAt: now,
    highRiskTriggered: false,
    perSignal: [],
  };
}

// RiskEvaluator 본체. 신호는 signalId 기준 중복 등록 거부
export class RiskEvaluator {
  private readonly signals: RiskSignal[] = [];
  private readonly signalIds = new Set<string>();

  public constructor(
    private readonly decision: RiskDecisionFunction = defaultRiskDecisionFunction,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  public registerSignal(signal: RiskSignal): void {
    if (this.signalIds.has(signal.signalId)) {
      throw new Error(
        `RiskEvaluator: duplicate signalId "${signal.signalId}"`,
      );
    }
    this.signalIds.add(signal.signalId);
    this.signals.push(signal);
  }

  public get registeredSignalIds(): ReadonlyArray<string> {
    return this.signals.map((s) => s.signalId);
  }

  public evaluateUtterance(
    input: RiskInput,
    prevState: RiskState,
  ): { latest: UtteranceRiskAssessment; nextState: RiskState } {
    const now = this.clock();

    const perSignal = this.signals.map((signal) => ({
      signalId: signal.signalId,
      level: signal.evaluate(input),
    }));

    const combinedLevel = this.decision.decide(perSignal);

    const transitionedState = this.applyTransition(prevState, combinedLevel);

    const snapshots: RiskSignalSnapshot[] = perSignal.map((p) => ({
      signalId: p.signalId,
      level: p.level,
      evaluatedAt: now,
    }));

    const nextState: RiskState = {
      ...transitionedState,
      lastEvaluatedAt: now,
      perSignal: mergeSnapshots(prevState.perSignal, snapshots),
    };

    return {
      latest: { perSignal, combinedLevel },
      nextState,
    };
  }

  public applyTransition(prev: RiskState, latest: RiskLevel): RiskState {
    const prevWeight = RISK_WEIGHT[prev.current];
    const latestWeight = RISK_WEIGHT[latest];

    let nextLevel: RiskLevel;
    let nextLowerCount: number;

    if (latestWeight > prevWeight) {
      nextLevel = latest;
      nextLowerCount = 0;
    } else if (latestWeight === prevWeight) {
      nextLevel = prev.current;
      nextLowerCount = 0;
    } else {
      const incremented = prev.consecutiveLowerCount + 1;
      if (incremented >= DOWNWARD_TRANSITION_THRESHOLD) {
        nextLevel = latest;
        nextLowerCount = 0;
      } else {
        nextLevel = prev.current;
        nextLowerCount = incremented;
      }
    }

    return {
      current: nextLevel,
      consecutiveLowerCount: nextLowerCount,
      lastEvaluatedAt: prev.lastEvaluatedAt,
      highRiskTriggered: prev.highRiskTriggered || nextLevel === '고위험',
      perSignal: prev.perSignal,
    };
  }
}

function mergeSnapshots(
  previous: ReadonlyArray<RiskSignalSnapshot>,
  latest: ReadonlyArray<RiskSignalSnapshot>,
): RiskSignalSnapshot[] {
  const map = new Map<string, RiskSignalSnapshot>();
  for (const snap of previous) {
    map.set(snap.signalId, snap);
  }
  for (const snap of latest) {
    map.set(snap.signalId, snap);
  }
  return Array.from(map.values()).sort((a, b) =>
    a.signalId < b.signalId ? -1 : a.signalId > b.signalId ? 1 : 0,
  );
}

export function createMvpRiskEvaluator(
  keywordLookup: KeywordLookup,
  keywordOptions?: KeywordMatchOptions,
): {
  evaluator: RiskEvaluator;
  keywordSignal: KeywordSignal;
  emotionScoreSignal: EmotionScoreSignal;
  suicidalityModelSignal: SuicidalityModelSignal;
} {
  const evaluator = new RiskEvaluator();
  const keywordSignal = new KeywordSignal(keywordLookup, keywordOptions);
  const emotionScoreSignal = new EmotionScoreSignal();
  const suicidalityModelSignal = new SuicidalityModelSignal();
  evaluator.registerSignal(keywordSignal);
  evaluator.registerSignal(emotionScoreSignal);
  evaluator.registerSignal(suicidalityModelSignal);
  return { evaluator, keywordSignal, emotionScoreSignal, suicidalityModelSignal };
}

export { defaultDecide as decideRiskLevel };
