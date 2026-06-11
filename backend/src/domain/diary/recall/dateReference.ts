// 한국어 상대 날짜 표현을 session_date 범위로 변환하는 순수 함수

import type { DateRange, DateReference } from './types.js';

const RELATIVE_NUMERIC_PATTERN = /(\d+)\s*(일|주일|주)\s*전/;

const LAST_WEEKDAY_PATTERN = /(?:지난|저번)\s*(?:주\s*)?(월|화|수|목|금|토|일)요일/;

const WEEKDAY_OFFSET: Readonly<Record<string, number>> = {
  월: 0,
  화: 1,
  수: 2,
  목: 3,
  금: 4,
  토: 5,
  일: 6,
};

function ymdToUtcMs(ymd: string): number {
  const [y, m, d] = ymd.split('-').map((s) => Number.parseInt(s, 10));
  return Date.UTC(y!, (m ?? 1) - 1, d ?? 1);
}

function utcMsToYmd(ms: number): string {
  const dt = new Date(ms);
  const y = dt.getUTCFullYear().toString().padStart(4, '0');
  const m = (dt.getUTCMonth() + 1).toString().padStart(2, '0');
  const d = dt.getUTCDate().toString().padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function addDays(ymd: string, n: number): string {
  return utcMsToYmd(ymdToUtcMs(ymd) + n * DAY_MS);
}

function singleDay(ymd: string): DateRange {
  return { from: ymd, to: ymd };
}

function mondayOfWeek(ymd: string): string {
  const day = new Date(ymdToUtcMs(ymd)).getUTCDay();
  const backToMonday = (day + 6) % 7;
  return addDays(ymd, -backToMonday);
}

export function resolveDateReference(
  userText: string,
  today: string,
): DateReference | undefined {
  const text = userText.normalize('NFC');

  const weekday = LAST_WEEKDAY_PATTERN.exec(text);
  if (weekday !== null) {
    const offset = WEEKDAY_OFFSET[weekday[1]!]!;
    const prevMonday = addDays(mondayOfWeek(today), -7);
    const target = addDays(prevMonday, offset);
    return { range: singleDay(target), matched: weekday[0] };
  }

  const numeric = RELATIVE_NUMERIC_PATTERN.exec(text);
  if (numeric !== null) {
    const amount = Number.parseInt(numeric[1]!, 10);
    const unit = numeric[2]!;
    if (Number.isFinite(amount) && amount > 0) {
      const days = unit === '일' ? amount : amount * 7;
      const target = addDays(today, -days);
      return { range: singleDay(target), matched: numeric[0] };
    }
  }

  if (text.includes('그끄제') || text.includes('그끄저께')) {
    return { range: singleDay(addDays(today, -3)), matched: '그끄제' };
  }
  if (text.includes('그제') || text.includes('그저께') || text.includes('엊그제')) {
    return { range: singleDay(addDays(today, -2)), matched: '그제' };
  }
  if (text.includes('어제')) {
    return { range: singleDay(addDays(today, -1)), matched: '어제' };
  }
  if (text.includes('오늘')) {
    return { range: singleDay(today), matched: '오늘' };
  }

  if (text.includes('지난주') || text.includes('저번주') || text.includes('저번 주')) {
    const prevMonday = addDays(mondayOfWeek(today), -7);
    return { range: { from: prevMonday, to: addDays(prevMonday, 6) }, matched: '지난주' };
  }

  return undefined;
}
