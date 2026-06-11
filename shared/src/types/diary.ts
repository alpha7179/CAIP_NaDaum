// 정서 일기 산출물 공유 타입 (diary_entries 테이블과 1:1 대응)

import type { EmotionScores } from './emotion.js';
import type { RiskLevel } from './risk.js';

export type DiaryBodyType = 'full' | 'brief';

export const DIARY_FULL_BODY_MIN_LENGTH = 200;
export const DIARY_FULL_BODY_MAX_LENGTH = 1000;

export const DIARY_FULL_MIN_USER_UTTERANCES = 3;

export const DIARY_TITLE_MAX_LENGTH = 10;

export const DIARY_MAX_TAGS = 4;

export const DIARY_TAG_MAX_LENGTH = 12;

// 정서 일기 산출물
export interface DiaryEntry {
  diaryId: string;
  userId: string;
  sessionId: string;
  sessionDate: string;
  title: string;
  tags: string[];
  bodyType: DiaryBodyType;
  body: string;
  emotionScores: EmotionScores;
  peakRiskLevel: RiskLevel;
  createdAt: Date;
}
