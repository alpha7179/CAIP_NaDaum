// 나다움 SVG 아이콘 라이브러리 (stroke=currentColor)
import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement>;

export const Icon = {
  home: (p: P) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" {...p}>
      <path d="M3.5 10.5 12 4l8.5 6.5M5.5 9.2V19a1 1 0 0 0 1 1H10v-5h4v5h3.5a1 1 0 0 0 1-1V9.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  chat: (p: P) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" {...p}>
      <path d="M4 5.5h16a1 1 0 0 1 1 1V16a1 1 0 0 1-1 1H9l-4 3.5V17H4a1 1 0 0 1-1-1V6.5a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  ),
  book: (p: P) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" {...p}>
      <path d="M5 4.5h11a2 2 0 0 1 2 2V20H7a2 2 0 0 1-2-2V4.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M18 6.5h1.5V20H7a2 2 0 0 0-2 2" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M8.5 8.5h6M8.5 12h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  ),
  doc: (p: P) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" {...p}>
      <path d="M6 3h7l5 5v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M13 3v5h5" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M8.5 12.5h7M8.5 16h7M8.5 9h2.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  ),
  mic: (p: P) => (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" {...p}>
      <rect x="9" y="3" width="6" height="11" rx="3" stroke="currentColor" strokeWidth="1.9" />
      <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  ),
  back: (p: P) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" {...p}>
      <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  chevrons: (p: P) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" {...p}>
      <path d="M16 6l-6 6 6 6M9 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  shield: (p: P) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" {...p}>
      <path d="M12 3l7 2.6v5.7c0 4.2-2.9 7.3-7 8.2-4.1-.9-7-4-7-8.2V5.6L12 3Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M9 11.6l2 2 4-4.1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  bridge: (p: P) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" {...p}>
      <circle cx="6" cy="12" r="2.6" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="18" cy="12" r="2.6" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8.6 12h6.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  ),
  arrow: (p: P) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" {...p}>
      <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  plus: (p: P) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" {...p}>
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  ),
  spark: (p: P) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" {...p}>
      <path d="M12 3c.6 3.8 2.2 5.4 6 6-3.8.6-5.4 2.2-6 6-.6-3.8-2.2-5.4-6-6 3.8-.6 5.4-2.2 6-6Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  ),
  flame: (p: P) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" {...p}>
      <path d="M12 3c.5 2.5-1.5 3.8-1.5 6 0 1-1-1.5-2.5-1.5C7 9.5 6 11 6 13.5 6 17 8.7 20 12 20s6-2.7 6-6.5c0-4-3-6.5-3-8 0 1.5-1.5 2.5-3 2-.2-2-.5-3.5 0-4.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  ),
  check: (p: P) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" {...p}>
      <path d="M5 12.5l4.5 4.5L19 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  logo: (p: P) => (
    <svg width="30" height="30" viewBox="0 0 32 32" fill="none" {...p}>
      <circle cx="16" cy="16" r="13" stroke="currentColor" strokeWidth="1.6" opacity="0.25" />
      <circle cx="16" cy="16" r="8" stroke="currentColor" strokeWidth="1.6" opacity="0.5" />
      <circle cx="16" cy="16" r="3.4" fill="currentColor" />
    </svg>
  ),
} as const;

export type IconName = keyof typeof Icon;
