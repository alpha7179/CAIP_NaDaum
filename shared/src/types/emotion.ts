// 감정 분석 도메인 공유 타입

// 기본 감정 7종 1-10 정수 점수 (후처리에서 클램프·라운드)
export interface EmotionScores {
  기쁨: number;
  슬픔: number;
  분노: number;
  불안: number;
  놀람: number;
  혐오: number;
  중립: number;
}

export const EMOTION_CATEGORIES = [
  '기쁨',
  '슬픔',
  '분노',
  '불안',
  '놀람',
  '혐오',
  '중립',
] as const satisfies ReadonlyArray<keyof EmotionScores>;

export type EmotionCategory = (typeof EMOTION_CATEGORIES)[number];

export type CognitiveDistortion =
  | '흑백논리'
  | '과잉일반화'
  | '파국화'
  | '감정적추론';

export const COGNITIVE_DISTORTIONS = [
  '흑백논리',
  '과잉일반화',
  '파국화',
  '감정적추론',
] as const satisfies ReadonlyArray<CognitiveDistortion>;

export type CalibrationPolicy = 'weighted_avg' | 'max' | 'text_only';

// 단일 채널의 감정 분석 결과
export interface ChannelResult {
  channelId: string;
  scores: EmotionScores;
  distortions?: CognitiveDistortion[];
  confidence: number;
  meta: {
    latencyMs: number;
    modelVersion: string;
  };
}

// 다중 채널 결과를 합성한 캘리브레이션 감정 결과
export interface CalibratedEmotion {
  combinedScores: EmotionScores;
  perChannel: ChannelResult[];
  missingChannels: string[];
  policy: CalibrationPolicy;
}

// 단일 발화의 감정 분석 결과
export interface EmotionAnalysisResult {
  scores: EmotionScores;
  distortions: CognitiveDistortion[];
  analyzedAt: Date;
}
