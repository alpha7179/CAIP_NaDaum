// 일기 회상 도메인 타입

import type { DiaryEntry } from '@nadaum/shared';

// 과거 회상 의도 감지 결과
export interface RecallTriggerResult {
  readonly triggered: boolean;
  readonly cues: readonly string[];
}

// 날짜 범위(포함 경계, YYYY-MM-DD, from <= to)
export interface DateRange {
  readonly from: string;
  readonly to: string;
}

// 날짜 표현 파싱 결과
export interface DateReference {
  readonly range: DateRange;
  readonly matched: string;
}

export type RecallSource = 'date' | 'semantic';

// 회수된 단일 일기 항목
export interface RecalledDiary {
  readonly diary: DiaryEntry;
  readonly source: RecallSource;
  readonly score: number;
}
