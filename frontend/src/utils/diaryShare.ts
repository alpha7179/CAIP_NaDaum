// 일기 공유 유틸 — 마크다운(.md) / 이미지(.png Canvas 카드), 외부 의존성 없음

import type { DiaryEntry, EmotionScores } from '@nadaum/shared';

import { deriveTitle, formatDiaryDate } from '../pages/HomePage';

const EMOTION_EMOJI: ReadonlyArray<readonly [keyof EmotionScores, string]> = [
  ['기쁨', '😊'],
  ['슬픔', '😢'],
  ['분노', '😠'],
  ['불안', '😰'],
  ['놀람', '😮'],
  ['혐오', '😣'],
  ['중립', '😐'],
];

const BRAND = '「나,다움」';

function dominantEmotion(scores: EmotionScores): keyof EmotionScores {
  let best: keyof EmotionScores = '중립';
  let bestVal = -Infinity;
  for (const [key] of EMOTION_EMOJI) {
    const v = scores[key] ?? 0;
    if (v > bestVal) { bestVal = v; best = key; }
  }
  return best;
}

function safeFileName(raw: string): string {
  const cleaned = raw.replace(/[\\/:*?"<>|\n\r\t]+/g, ' ').replace(/\s+/g, ' ').trim();
  const sliced = cleaned.slice(0, 40).trim();
  return sliced.length > 0 ? sliced : '일기';
}

function diaryTitle(entry: DiaryEntry): string {
  return entry.title || deriveTitle(entry.body);
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export const SUMMARY_DEFAULT_LINES = 3;
export const SUMMARY_MIN_LINES = 1;
export const SUMMARY_MAX_LINES = 20;

export function countDiaryLines(body: string): number {
  const parts = body
    .replace(/\r\n/g, '\n')
    .split(/(?<=[.!?。…])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return Math.max(SUMMARY_MIN_LINES, parts.length);
}

export function buildDiaryMarkdown(entry: DiaryEntry): string {
  const title = diaryTitle(entry);
  const date = formatDiaryDate(entry.sessionDate);
  const lines: string[] = [];

  lines.push(`# ${title}`);
  lines.push('');
  lines.push(`> ${date} · 대화로 쓴 일기`);
  lines.push('');

  for (const para of entry.body.split('\n')) {
    const t = para.trim();
    if (t.length > 0) { lines.push(t); lines.push(''); }
  }

  const tags = entry.tags ?? [];
  if (tags.length > 0) {
    lines.push('---');
    lines.push('');
    lines.push(tags.map((t) => `#${t}`).join(' '));
    lines.push('');
  }

  const dom = dominantEmotion(entry.emotionScores);
  const domEmoji = EMOTION_EMOJI.find(([k]) => k === dom)?.[1] ?? '';
  lines.push(`오늘의 감정: ${domEmoji} ${dom}`);
  lines.push('');
  lines.push(`_${BRAND}에서 기록한 일기_`);

  return lines.join('\n');
}

export function downloadDiaryMarkdown(entry: DiaryEntry): void {
  const md = buildDiaryMarkdown(entry);
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
  triggerDownload(blob, `${safeFileName(diaryTitle(entry))}.md`);
}

const FONT_STACK =
  "'Pretendard Variable', Pretendard, 'Apple SD Gothic Neo', 'Noto Sans KR', system-ui, -apple-system, sans-serif";

const HAND_FONT = 'King Sejong Institute';
const HAND_STACK = `'${HAND_FONT}', ${FONT_STACK}`;

let handFontLoad: Promise<void> | null = null;
function startHandFontLoad(): Promise<void> {
  if (!handFontLoad) {
    handFontLoad = Promise.all([
      document.fonts.load(`400 20px '${HAND_FONT}'`),
      document.fonts.load(`700 20px '${HAND_FONT}'`),
    ]).then(() => undefined).catch(() => undefined);
  }
  return handFontLoad;
}

async function ensureFontsReady(): Promise<void> {
  if (typeof document === 'undefined' || !('fonts' in document)) return;
  if (document.fonts.check(`20px '${HAND_FONT}'`)) return;
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, 3000));
  await Promise.race([startHandFontLoad(), timeout]);
}

const TWEMOJI_BASE = 'https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.1.0/assets/72x72/';
const stickerCache = new Map<string, Promise<HTMLImageElement | null>>();

function loadSticker(emoji: string): Promise<HTMLImageElement | null> {
  let p = stickerCache.get(emoji);
  if (!p) {
    p = new Promise<HTMLImageElement | null>((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      const code = [...emoji].map((c) => c.codePointAt(0)!.toString(16)).join('-');
      img.src = `${TWEMOJI_BASE}${code}.png`;
    });
    void p.then((v) => { if (v === null) stickerCache.delete(emoji); });
    stickerCache.set(emoji, p);
  }
  return p;
}

function loadEmotionStickers(): Promise<ReadonlyArray<HTMLImageElement | null> | null> {
  const all = Promise.all(EMOTION_EMOJI.map(([, emoji]) => loadSticker(emoji)));
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000));
  return Promise.race([all, timeout]);
}

function shortBadgeDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const wd = '일월화수목금토'[d.getDay()];
  return `${m[2]}월 ${m[3]}일 (${wd})`;
}

function wrapParagraph(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const out: string[] = [];
  let line = '';
  for (const ch of text) {
    const test = line + ch;
    if (ctx.measureText(test).width > maxWidth && line !== '') {
      out.push(line);
      line = ch;
    } else {
      line = test;
    }
  }
  if (line.length > 0) out.push(line);
  return out.length > 0 ? out : [''];
}

const INK = '#222222';
const PAPER = '#fdfdfb';
const NOTE_BG = '#d5d5d8';
const DOT = 'rgba(90, 90, 96, 0.28)';
const BADGE_RED = '#bf4135';
const HIGHLIGHT = '#f0d9a0';
const SOFT_INK = '#8a8a8a';

export async function renderDiaryImage(entry: DiaryEntry): Promise<Blob> {
  const [, stickers] = await Promise.all([ensureFontsReady(), loadEmotionStickers()]);

  const W = 760;
  const cardX = 84;
  const cardW = W - cardX * 2;
  const BORDER_INSET = 16;
  const INNER_PAD = 34;
  const contentX = cardX + BORDER_INSET + INNER_PAD;
  const contentW = cardW - (BORDER_INSET + INNER_PAD) * 2;
  const ratio = Math.min(window.devicePixelRatio || 1, 2);

  const measure = document.createElement('canvas').getContext('2d')!;

  const title = diaryTitle(entry);
  const badgeDate = shortBadgeDate(entry.sessionDate);
  const tags = entry.tags ?? [];
  const dom = dominantEmotion(entry.emotionScores);

  const titleSize = 38;
  const titleLineH = 54;
  const bodySize = 26;
  const bodyLineH = 48;
  const faceR = 21;

  measure.font = `700 ${titleSize}px ${HAND_STACK}`;
  const titleLines = wrapParagraph(measure, title, contentW - 90);

  measure.font = `400 ${bodySize}px ${HAND_STACK}`;
  const bodyParas = entry.body.split('\n').map((p) => p.trim()).filter((p) => p.length > 0);
  const bodyBlocks = bodyParas.map((p) => wrapParagraph(measure, p, contentW));

  let contentH = 0;
  contentH += 8;
  contentH += titleLines.length * titleLineH;
  contentH += 24;
  for (const block of bodyBlocks) {
    contentH += block.length * bodyLineH;
    contentH += 12;
  }
  contentH += 6;
  if (tags.length > 0) contentH += 36;
  contentH += 18;
  contentH += faceR * 2;
  contentH += 46;
  contentH += 26;
  contentH += 24;
  const cardH = contentH + (BORDER_INSET + INNER_PAD) * 2;

  const PAD_TOP = 46;
  const badgeH = 54;
  const gapBadgeCard = 32;
  const cardY = PAD_TOP + badgeH + gapBadgeCard;
  const H = cardY + cardH + 46;

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(W * ratio);
  canvas.height = Math.round(H * ratio);
  const ctx = canvas.getContext('2d')!;
  ctx.scale(ratio, ratio);
  ctx.textBaseline = 'top';

  const rand = mulberry32(entry.body.length * 7919 + title.length * 131 + 17);

  ctx.fillStyle = NOTE_BG;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = DOT;
  for (let dy = 16; dy < H; dy += 26) {
    for (let dx = 16; dx < W; dx += 26) {
      ctx.beginPath();
      ctx.arc(dx, dy, 1.3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.font = `700 29px ${HAND_STACK}`;
  const badgeTextW = ctx.measureText(badgeDate).width;
  const badgeW = badgeTextW + 58;
  const badgeX = (W - badgeW) / 2;
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.14)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 3;
  roundRect(ctx, badgeX, PAD_TOP, badgeW, badgeH, 16);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = BADGE_RED;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  handRoundRect(ctx, badgeX, PAD_TOP, badgeW, badgeH, 16, rand, 1.6);
  ctx.fillStyle = INK;
  ctx.textAlign = 'center';
  ctx.fillText(badgeDate, W / 2, PAD_TOP + 13);
  ctx.textAlign = 'left';

  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.18)';
  ctx.shadowBlur = 22;
  ctx.shadowOffsetY = 10;
  roundRect(ctx, cardX, cardY, cardW, cardH, 8);
  ctx.fillStyle = PAPER;
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  handRoundRect(ctx, cardX + BORDER_INSET, cardY + BORDER_INSET, cardW - BORDER_INSET * 2, cardH - BORDER_INSET * 2, 4, rand, 1.8);

  const contentTop = cardY + BORDER_INSET + INNER_PAD;
  let cy = contentTop;
  cy += 8;

  ctx.font = `700 ${titleSize}px ${HAND_STACK}`;
  ctx.fillStyle = INK;
  ctx.textAlign = 'center';
  const centerX = contentX + contentW / 2;
  for (const line of titleLines) {
    ctx.fillText(line, centerX, cy);
    cy += titleLineH;
  }
  if (titleLines.length === 1) {
    const tw = ctx.measureText(titleLines[0]!).width;
    const dashY = cy - titleLineH + titleSize * 0.58;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    handLine(ctx, centerX - tw / 2 - 44, dashY, centerX - tw / 2 - 18, dashY, rand);
    handLine(ctx, centerX + tw / 2 + 18, dashY, centerX + tw / 2 + 44, dashY, rand);
  }
  ctx.textAlign = 'left';
  cy += 24;

  ctx.font = `400 ${bodySize}px ${HAND_STACK}`;
  for (const block of bodyBlocks) {
    for (const line of block) {
      ctx.fillStyle = INK;
      ctx.fillText(line, contentX, cy);
      ctx.strokeStyle = 'rgba(34, 34, 34, 0.8)';
      ctx.lineWidth = 1.6;
      ctx.lineCap = 'round';
      handLine(ctx, contentX, cy + bodyLineH - 11, contentX + contentW, cy + bodyLineH - 11, rand, 2);
      cy += bodyLineH;
    }
    cy += 12;
  }
  cy += 6;

  if (tags.length > 0) {
    ctx.font = `400 21px ${HAND_STACK}`;
    ctx.fillStyle = SOFT_INK;
    ctx.textAlign = 'center';
    ctx.fillText(tags.map((t) => `#${t}`).join('  '), centerX, cy);
    ctx.textAlign = 'left';
    cy += 36;
  }
  cy += 18;

  const FACE_EDGE_GAP = 19;
  const domR = faceR + 8;
  const slotR = EMOTION_EMOJI.map(([key]) => (key === dom ? domR : faceR));
  const rowW = slotR.reduce((sum, r) => sum + r * 2, 0) + FACE_EDGE_GAP * (slotR.length - 1);
  let fx = contentX + (contentW - rowW) / 2;
  const faceCy = cy + faceR;
  let domCx = fx;
  ctx.imageSmoothingQuality = 'high';
  for (let i = 0; i < EMOTION_EMOJI.length; i++) {
    const [key] = EMOTION_EMOJI[i]!;
    const r = slotR[i]!;
    const cxF = fx + r;
    const img = stickers?.[i] ?? null;
    const highlighted = key === dom;
    if (highlighted) domCx = cxF;
    if (img) {
      if (highlighted) {
        ctx.fillStyle = HIGHLIGHT;
        ctx.beginPath();
        ctx.arc(cxF, faceCy, domR, 0, Math.PI * 2);
        ctx.fill();
        ctx.drawImage(img, cxF - faceR - 4, faceCy - faceR - 4, (faceR + 4) * 2, (faceR + 4) * 2);
      } else {
        ctx.save();
        ctx.globalAlpha = 0.45;
        ctx.drawImage(img, cxF - faceR, faceCy - faceR, faceR * 2, faceR * 2);
        ctx.restore();
      }
    } else {
      drawFace(ctx, key, cxF, faceCy, faceR, highlighted);
    }
    fx += r * 2 + FACE_EDGE_GAP;
  }
  cy += faceR * 2;

  ctx.font = `400 18px ${HAND_STACK}`;
  ctx.fillStyle = SOFT_INK;
  ctx.textAlign = 'center';
  ctx.fillText(dom, domCx, cy + 20);
  ctx.textAlign = 'left';
  cy += 46;
  cy += 26;

  ctx.font = `400 19px ${HAND_STACK}`;
  ctx.fillStyle = SOFT_INK;
  ctx.textAlign = 'center';
  ctx.fillText(`${BRAND}에서 대화로 기록한 하루`, centerX, cy);
  ctx.textAlign = 'left';

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('이미지 생성에 실패했어요.'));
    }, 'image/png');
  });
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function handLine(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  rand: () => number,
  amp = 1.4,
): void {
  const j = () => (rand() - 0.5) * amp;
  ctx.beginPath();
  ctx.moveTo(x1 + j(), y1 + j());
  ctx.quadraticCurveTo((x1 + x2) / 2 + j() * 2, (y1 + y2) / 2 + j() * 2, x2 + j(), y2 + j());
  ctx.stroke();
}

function handRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  rand: () => number,
  amp = 1.5,
): void {
  const j = () => (rand() - 0.5) * amp;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.quadraticCurveTo(x + w / 2 + j() * 2, y + j() * 2, x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.quadraticCurveTo(x + w + j() * 2, y + h / 2 + j() * 2, x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.quadraticCurveTo(x + w / 2 + j() * 2, y + h + j() * 2, x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.quadraticCurveTo(x + j() * 2, y + h / 2 + j() * 2, x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
  ctx.stroke();
}

function drawFace(
  ctx: CanvasRenderingContext2D,
  emotion: keyof EmotionScores,
  cx: number,
  cy: number,
  r: number,
  highlighted: boolean,
): void {
  ctx.save();
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.strokeStyle = INK;
  ctx.fillStyle = INK;

  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  if (highlighted) {
    ctx.fillStyle = HIGHLIGHT;
    ctx.fill();
    ctx.fillStyle = INK;
  }
  ctx.stroke();

  const ex = r * 0.38;
  const ey = cy - r * 0.18;
  const dot = (x: number, y: number) => {
    ctx.beginPath();
    ctx.arc(x, y, 1.9, 0, Math.PI * 2);
    ctx.fill();
  };

  switch (emotion) {
    case '기쁨':
      ctx.beginPath(); ctx.arc(cx - ex, ey, 3.4, Math.PI, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx + ex, ey, 3.4, Math.PI, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, cy + r * 0.1, r * 0.42, Math.PI * 0.2, Math.PI * 0.8); ctx.stroke();
      break;
    case '슬픔':
      dot(cx - ex, ey); dot(cx + ex, ey);
      ctx.beginPath(); ctx.arc(cx, cy + r * 0.66, r * 0.34, Math.PI * 1.2, Math.PI * 1.8); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx + ex + 3.5, ey + 6.5, 2.2, 0, Math.PI * 2); ctx.fill();
      break;
    case '분노':
      ctx.beginPath(); ctx.moveTo(cx - ex - 4, ey - 7); ctx.lineTo(cx - ex + 2, ey - 3.5); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx + ex + 4, ey - 7); ctx.lineTo(cx + ex - 2, ey - 3.5); ctx.stroke();
      dot(cx - ex, ey + 1); dot(cx + ex, ey + 1);
      ctx.beginPath(); ctx.arc(cx, cy + r * 0.7, r * 0.3, Math.PI * 1.25, Math.PI * 1.75); ctx.stroke();
      break;
    case '불안':
      dot(cx - ex, ey); dot(cx + ex, ey);
      ctx.beginPath();
      ctx.moveTo(cx - 6, cy + r * 0.38);
      ctx.quadraticCurveTo(cx - 3, cy + r * 0.26, cx, cy + r * 0.38);
      ctx.quadraticCurveTo(cx + 3, cy + r * 0.5, cx + 6, cy + r * 0.38);
      ctx.stroke();
      ctx.beginPath(); ctx.arc(cx + r * 0.72, cy - r * 0.52, 2.4, 0, Math.PI * 2); ctx.fill();
      break;
    case '놀람':
      ctx.beginPath(); ctx.arc(cx - ex, ey, 2.8, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx + ex, ey, 2.8, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, cy + r * 0.42, 3.4, 0, Math.PI * 2); ctx.stroke();
      break;
    case '혐오':
      ctx.beginPath(); ctx.moveTo(cx - ex - 3, ey); ctx.lineTo(cx - ex + 3, ey - 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx + ex + 3, ey); ctx.lineTo(cx + ex - 3, ey - 2); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - 5.5, cy + r * 0.42);
      ctx.quadraticCurveTo(cx - 2, cy + r * 0.3, cx + 1, cy + r * 0.42);
      ctx.quadraticCurveTo(cx + 4, cy + r * 0.52, cx + 6, cy + r * 0.4);
      ctx.stroke();
      break;
    case '중립':
    default:
      dot(cx - ex, ey); dot(cx + ex, ey);
      ctx.beginPath(); ctx.moveTo(cx - 5.5, cy + r * 0.42); ctx.lineTo(cx + 5.5, cy + r * 0.42); ctx.stroke();
      break;
  }
  ctx.restore();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export function diaryDisplayTitle(entry: DiaryEntry): string {
  return diaryTitle(entry);
}

export function diaryDominantEmotion(entry: DiaryEntry): { label: keyof EmotionScores; emoji: string } {
  const label = dominantEmotion(entry.emotionScores);
  const emoji = EMOTION_EMOJI.find(([k]) => k === label)?.[1] ?? '';
  return { label, emoji };
}

export function diaryFileBase(entry: DiaryEntry): string {
  return safeFileName(diaryTitle(entry));
}

export function saveBlob(blob: Blob, filename: string): void {
  triggerDownload(blob, filename);
}

export async function downloadDiaryImage(entry: DiaryEntry): Promise<void> {
  const blob = await renderDiaryImage(entry);
  triggerDownload(blob, `${safeFileName(diaryTitle(entry))}.png`);
}
