// `EmotionAnalyzer` — 등록된 감정 채널을 병렬 호출하고 결과를 통합하는 도메인 서비스

import { EMOTION_CATEGORIES } from '@nadaum/shared';
import type {
  CalibratedEmotion,
  CalibrationPolicy,
  ChannelResult,
  EmotionAnalysisResult,
  EmotionScores,
} from '@nadaum/shared';
import type { EmotionProfile } from '@nadaum/shared';

import {
  DefaultChannelCalibrator,
  type ChannelCalibrator,
} from './ChannelCalibrator.js';
import type {
  ChannelAnalyzeContext,
  ChannelInput,
  EmotionChannel,
} from './EmotionChannel.js';

// `EmotionAnalyzer` 생성자 옵션.
export interface EmotionAnalyzerOptions {
  readonly policy?: CalibrationPolicy;
  readonly calibrator?: ChannelCalibrator;
}

// 감정 분석 서비스 본체.
export class EmotionAnalyzer {
  private readonly channels: EmotionChannel[] = [];
  private readonly policy: CalibrationPolicy;
  private readonly calibrator: ChannelCalibrator;

  public constructor(options: EmotionAnalyzerOptions = {}) {
    this.policy = options.policy ?? 'text_only';
    this.calibrator = options.calibrator ?? new DefaultChannelCalibrator();
  }

  public registerChannel(channel: EmotionChannel): void {
    const existing = this.channels.find((c) => c.channelId === channel.channelId);
    if (existing !== undefined) {
      throw new Error(
        `EmotionAnalyzer: channel with id "${channel.channelId}" is already registered`,
      );
    }
    this.channels.push(channel);
  }

  public getRegisteredChannelIds(): readonly string[] {
    return this.channels.map((c) => c.channelId);
  }

  public getPolicy(): CalibrationPolicy {
    return this.policy;
  }

  public async analyze(
    input: ChannelInput,
    context: ChannelAnalyzeContext,
  ): Promise<CalibratedEmotion> {
    if (this.channels.length === 0) {
      return this.calibrator.combine([], this.policy);
    }

    const availability = await Promise.all(
      this.channels.map(async (channel) => {
        try {
          const ok = await channel.isAvailable();
          return { channel, available: ok === true };
        } catch {
          return { channel, available: false };
        }
      }),
    );

    const missing: string[] = [];
    const available: EmotionChannel[] = [];
    for (const { channel, available: ok } of availability) {
      if (ok) {
        available.push(channel);
      } else {
        missing.push(channel.channelId);
      }
    }

    const settled = await Promise.all(
      available.map(async (channel) => {
        try {
          const result = await channel.analyze(input, context);
          return { ok: true as const, result };
        } catch {
          return { ok: false as const, channelId: channel.channelId };
        }
      }),
    );

    const results: ChannelResult[] = [];
    for (const entry of settled) {
      if (entry.ok) {
        results.push(entry.result);
      } else {
        missing.push(entry.channelId);
      }
    }

    return this.calibrator.combine(results, this.policy, {
      missingChannelIds: missing,
    });
  }
}

export function createMvpEmotionAnalyzer(textChannel: EmotionChannel): EmotionAnalyzer {
  const analyzer = new EmotionAnalyzer({ policy: 'text_only' });
  analyzer.registerChannel(textChannel);
  return analyzer;
}

export function appendUtteranceResult(
  profile: EmotionProfile,
  result: EmotionAnalysisResult,
): EmotionProfile {
  const utteranceScores: EmotionAnalysisResult[] = [...profile.utteranceScores, result];  const aggregate = computeAggregate(utteranceScores);
  return {
    utteranceScores,
    aggregate,
  };
}

function computeAggregate(results: readonly EmotionAnalysisResult[]): EmotionScores {
  if (results.length === 0) {
    return {
      기쁨: 5,
      슬픔: 5,
      분노: 5,
      불안: 5,
      놀람: 5,
      혐오: 5,
      중립: 5,
    };
  }
  const partial: Partial<EmotionScores> = {};
  for (const category of EMOTION_CATEGORIES) {
    let sum = 0;
    let count = 0;
    for (const r of results) {
      const v = r.scores[category];
      if (typeof v === 'number' && Number.isFinite(v)) {
        sum += v;
        count += 1;
      }
    }
    const mean = count > 0 ? sum / count : 5;
    partial[category] = clampRoundInt(mean);
  }
  return {
    기쁨: partial.기쁨 ?? 5,
    슬픔: partial.슬픔 ?? 5,
    분노: partial.분노 ?? 5,
    불안: partial.불안 ?? 5,
    놀람: partial.놀람 ?? 5,
    혐오: partial.혐오 ?? 5,
    중립: partial.중립 ?? 5,
  };
}

function clampRoundInt(value: number): number {
  if (!Number.isFinite(value)) {
    return 5;
  }
  const rounded = Math.round(value);
  if (rounded < 1) {
    return 1;
  }
  if (rounded > 10) {
    return 10;
  }
  return rounded;
}
