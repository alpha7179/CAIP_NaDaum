// 감정 분석 모달리티 채널 — `EmotionChannel` 인터페이스 및 입력 타입

import type { ChannelResult } from '@nadaum/shared';

// 감정 채널 입력.
export interface ChannelInput {
  readonly text?: string;
  readonly audio?: Buffer;
  readonly meta?: Readonly<Record<string, unknown>>;
}

// 다운스트림 호출자가 채널 실행 컨텍스트를 전달하는 최소 인터페이스.
export interface ChannelAnalyzeContext {
  readonly sessionId: string;
  readonly userId: string;
}

// 감정 분석 채널 인터페이스.
export interface EmotionChannel {
  readonly channelId: string;
  analyze(input: ChannelInput, context: ChannelAnalyzeContext): Promise<ChannelResult>;
  isAvailable(): Promise<boolean>;
}

export type { ChannelResult } from '@nadaum/shared';
