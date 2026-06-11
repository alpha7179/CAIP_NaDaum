// @nadaum/shared/types — 공유 타입 배럴 export

export type {
  CalibratedEmotion,
  CalibrationPolicy,
  ChannelResult,
  CognitiveDistortion,
  EmotionAnalysisResult,
  EmotionCategory,
  EmotionScores,
} from './emotion.js';
export { COGNITIVE_DISTORTIONS, EMOTION_CATEGORIES } from './emotion.js';

export type { ConversationStage, Exchange } from './dialogue.js';
export { CONVERSATION_STAGES } from './dialogue.js';

export type { RiskLevel, RiskSignalSnapshot, RiskState } from './risk.js';
export { RISK_LEVELS } from './risk.js';

export type {
  EmotionProfile,
  RiskTrajectoryPoint,
  SessionContext,
  SessionResult,
} from './session.js';

export type { DiaryBodyType, DiaryEntry } from './diary.js';
export {
  DIARY_FULL_BODY_MAX_LENGTH,
  DIARY_FULL_BODY_MIN_LENGTH,
  DIARY_FULL_MIN_USER_UTTERANCES,
  DIARY_TITLE_MAX_LENGTH,
  DIARY_MAX_TAGS,
  DIARY_TAG_MAX_LENGTH,
} from './diary.js';
