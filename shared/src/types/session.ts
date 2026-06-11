// 세션 라이프사이클 공유 타입

import type { ConversationStage, Exchange } from './dialogue.js';
import type {
  CalibratedEmotion,
  CognitiveDistortion,
  EmotionAnalysisResult,
  EmotionScores,
} from './emotion.js';
import type { RiskLevel, RiskState } from './risk.js';

// 세션 누적 감정 프로필 (활성 세션 메모리)
export interface EmotionProfile {
  utteranceScores: EmotionAnalysisResult[];
  aggregate: EmotionScores;
}

// 활성 세션 상태
export interface SessionContext {
  sessionId: string;
  userId: string;
  stage: ConversationStage;
  exchanges: Exchange[];
  cumulativeEmotion: EmotionProfile;
  riskState: RiskState;
  startedAt: Date;
  lastUtteranceAt: Date;
}

// 세션 종료 시 위험 궤적의 단일 지점
export interface RiskTrajectoryPoint {
  at: Date;
  level: RiskLevel;
  perSignal: Array<{ signalId: string; level: RiskLevel }>;
}

// 세션 종료 시 정규화된 결과 모델
export interface SessionResult {
  sessionId: string;
  userId: string;
  exchanges: Exchange[];
  cumulativeEmotion: CalibratedEmotion;
  distortions: CognitiveDistortion[];
  riskTrajectory: RiskTrajectoryPoint[];
  endedAt: Date;
}
