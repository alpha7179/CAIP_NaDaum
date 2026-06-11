// 발화가 과거 일기를 참조하는지 판정하는 순수 함수

import type { RecallTriggerResult } from './types.js';

const TIME_REFERENCE_CUES: readonly string[] = [
  '어제',
  '그제',
  '그저께',
  '그끄제',
  '그끄저께',
  '엊그제',
  '지난주',
  '지난번',
  '지난',
  '저번',
  '예전',
  '며칠 전',
  '며칠전',
  '얼마 전',
  '얼마전',
  '저번에',
  '전에',
];

const RECALL_VERB_CUES: readonly string[] = [
  '얘기했',
  '이야기했',
  '말했',
  '말씀드렸',
  '그랬었',
  '적었',
  '썼었',
  '기록했',
  '일기',
  '저번에 말',
  '전에 말',
];

const RELATIVE_NUMERIC_PATTERN = /(\d+)\s*(일|주|주일|달|개월)\s*전/;

const LAST_WEEKDAY_PATTERN = /(지난|저번)\s*(주\s*)?(월|화|수|목|금|토|일)요일/;

function normalize(text: string): string {
  return text.normalize('NFC').trim();
}

export function detectRecallTrigger(userText: string): RecallTriggerResult {
  const text = normalize(userText);
  if (text.length === 0) {
    return { triggered: false, cues: [] };
  }

  const cues: string[] = [];

  for (const cue of TIME_REFERENCE_CUES) {
    if (text.includes(cue)) {
      cues.push(cue);
    }
  }
  for (const cue of RECALL_VERB_CUES) {
    if (text.includes(cue)) {
      cues.push(cue);
    }
  }
  const numeric = RELATIVE_NUMERIC_PATTERN.exec(text);
  if (numeric !== null) {
    cues.push(numeric[0]);
  }
  const weekday = LAST_WEEKDAY_PATTERN.exec(text);
  if (weekday !== null) {
    cues.push(weekday[0]);
  }

  const uniqueCues = [...new Set(cues)];
  return { triggered: uniqueCues.length > 0, cues: uniqueCues };
}
