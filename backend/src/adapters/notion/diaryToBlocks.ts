// DiaryEntry를 노션 페이지(제목 + 블록 배열)로 변환

import type { DiaryEntry, EmotionScores } from '@nadaum/shared';

const EMOTION_EMOJI: ReadonlyArray<readonly [keyof EmotionScores, string]> = [
  ['기쁨', '😊'],
  ['슬픔', '😢'],
  ['분노', '😠'],
  ['불안', '😰'],
  ['놀람', '😮'],
  ['혐오', '😣'],
  ['중립', '😐'],
];

function formatDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[1]}년 ${Number(m[2])}월 ${Number(m[3])}일` : iso;
}

function formatTitleDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[1]}. ${m[2]}. ${m[3]}.` : '';
}

function deriveTitle(body: string): string {
  const first = body.split(/[.!?。\n]/)[0]?.trim() ?? '';
  if (first.length === 0) return '오늘의 기록';
  return first.length > 24 ? first.slice(0, 24) + '…' : first;
}

function dominantEmotion(scores: EmotionScores): { label: keyof EmotionScores; emoji: string } {
  let label: keyof EmotionScores = '중립';
  let best = -Infinity;
  for (const [key] of EMOTION_EMOJI) {
    const v = scores[key] ?? 0;
    if (v > best) { best = v; label = key; }
  }
  const emoji = EMOTION_EMOJI.find(([k]) => k === label)?.[1] ?? '';
  return { label, emoji };
}

function richText(content: string): Array<Record<string, unknown>> {
  return [{ type: 'text', text: { content: content.slice(0, 2000) } }];
}

function paragraph(content: string): Record<string, unknown> {
  return { object: 'block', type: 'paragraph', paragraph: { rich_text: richText(content) } };
}

export function diaryToNotionPage(entry: DiaryEntry): {
  title: string;
  children: Array<Record<string, unknown>>;
} {
  const baseTitle = entry.title || deriveTitle(entry.body);
  const date = formatDate(entry.sessionDate);
  const titleDate = formatTitleDate(entry.sessionDate);
  const title = titleDate.length > 0 ? `${titleDate} ${baseTitle}` : baseTitle;
  const tags = entry.tags ?? [];
  const dom = dominantEmotion(entry.emotionScores);

  const children: Array<Record<string, unknown>> = [];

  children.push({
    object: 'block',
    type: 'quote',
    quote: { rich_text: richText(`${date} · 대화로 쓴 일기`) },
  });

  for (const line of entry.body.split('\n')) {
    const t = line.trim();
    if (t.length > 0) children.push(paragraph(t));
  }

  children.push({ object: 'block', type: 'divider', divider: {} });

  if (tags.length > 0) {
    children.push(paragraph(tags.map((t) => `#${t}`).join('  ')));
  }

  children.push(paragraph(`오늘의 감정: ${dom.emoji} ${dom.label}`));
  children.push(paragraph('「나,다움」에서 기록한 일기'));

  return { title, children: children.slice(0, 100) };
}
