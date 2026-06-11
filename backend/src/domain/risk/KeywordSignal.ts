// 고위험 키워드 사전 매칭 기반 위험 신호

import type { RiskInput, RiskLevel, RiskSignal } from './RiskSignal.js';

// 키워드 조회 포트
export interface KeywordLookup {
  isHighRisk(text: string): Promise<boolean> | boolean;
  loadKeywords?(): Promise<ReadonlyArray<string>> | ReadonlyArray<string>;
}

// 키워드 매칭 정책 옵션
export interface KeywordMatchOptions {
  readonly fuzzy?: boolean;
  readonly maxEditDistance?: number;
  readonly minFuzzyLength?: number;
}

const DEFAULT_FUZZY_ENABLED = true;
const DEFAULT_MAX_EDIT_DISTANCE = 1;
const DEFAULT_MIN_FUZZY_LENGTH = 4;

function normalize(text: string): string {
  return text.normalize('NFC').replace(/\s+/g, '');
}

function withinEditDistance(a: string, b: string, max: number): boolean {
  const la = a.length;
  const lb = b.length;
  if (Math.abs(la - lb) > max) {
    return false;
  }
  if (max === 0) {
    return a === b;
  }
  let prev = new Array<number>(lb + 1);
  let curr = new Array<number>(lb + 1);
  for (let j = 0; j <= lb; j += 1) {
    prev[j] = j;
  }
  for (let i = 1; i <= la; i += 1) {
    curr[0] = i;
    let rowMin = curr[0];
    const ai = a.charCodeAt(i - 1);
    for (let j = 1; j <= lb; j += 1) {
      const cost = ai === b.charCodeAt(j - 1) ? 0 : 1;
      const del = prev[j]! + 1;
      const ins = curr[j - 1]! + 1;
      const sub = prev[j - 1]! + cost;
      const v = del < ins ? (del < sub ? del : sub) : ins < sub ? ins : sub;
      curr[j] = v;
      if (v < rowMin) {
        rowMin = v;
      }
    }
    if (rowMin > max) {
      return false;
    }
    const tmp = prev;
    prev = curr;
    curr = tmp;
  }
  return prev[lb]! <= max;
}

function fuzzyContains(haystack: string, needle: string, max: number): boolean {
  const n = needle.length;
  const minW = Math.max(1, n - max);
  const maxW = n + max;
  for (let w = minW; w <= maxW; w += 1) {
    if (w > haystack.length) {
      break;
    }
    for (let start = 0; start + w <= haystack.length; start += 1) {
      if (withinEditDistance(haystack.substr(start, w), needle, max)) {
        return true;
      }
    }
  }
  return false;
}

// 고위험 키워드 매칭으로 '고위험'/'저위험' 산출
export class KeywordSignal implements RiskSignal {
  public readonly signalId = 'keyword' as const;

  private normalizedKeywords: ReadonlyArray<string> = [];

  private fuzzyKeywords: ReadonlyArray<string> = [];

  private loaded = false;

  private readonly fuzzyEnabled: boolean;
  private readonly maxEditDistance: number;
  private readonly minFuzzyLength: number;

  public constructor(
    private readonly lookup: KeywordLookup,
    options: KeywordMatchOptions = {},
  ) {
    this.fuzzyEnabled = options.fuzzy ?? DEFAULT_FUZZY_ENABLED;
    this.maxEditDistance = options.maxEditDistance ?? DEFAULT_MAX_EDIT_DISTANCE;
    this.minFuzzyLength = options.minFuzzyLength ?? DEFAULT_MIN_FUZZY_LENGTH;
  }

  public async refresh(): Promise<void> {
    if (typeof this.lookup.loadKeywords !== 'function') {
      return;
    }
    const keywords = await this.lookup.loadKeywords();
    this.setCache(keywords);
  }

  public setKeywordsForTesting(keywords: ReadonlyArray<string>): void {
    this.setCache(keywords);
  }

  private setCache(keywords: ReadonlyArray<string>): void {
    const seen = new Set<string>();
    for (const kw of keywords) {
      if (typeof kw !== 'string') {
        continue;
      }
      const norm = normalize(kw);
      if (norm.length > 0) {
        seen.add(norm);
      }
    }
    this.normalizedKeywords = [...seen];
    this.fuzzyKeywords = this.fuzzyEnabled
      ? this.normalizedKeywords.filter((kw) => kw.length >= this.minFuzzyLength)
      : [];
    this.loaded = true;
  }

  public get cachedKeywordCount(): number {
    return this.normalizedKeywords.length;
  }

  public get isLoaded(): boolean {
    return this.loaded;
  }

  public evaluate(input: RiskInput): RiskLevel {
    return this.matchesAny(input.text) ? '고위험' : '저위험';
  }

  public async evaluateAsync(input: RiskInput): Promise<RiskLevel> {
    const matched = await Promise.resolve(this.lookup.isHighRisk(input.text));
    return matched ? '고위험' : '저위험';
  }

  private matchesAny(text: string): boolean {
    if (typeof text !== 'string' || text.length === 0) {
      return false;
    }
    const norm = normalize(text);
    if (norm.length === 0) {
      return false;
    }
    for (const kw of this.normalizedKeywords) {
      if (norm.includes(kw)) {
        return true;
      }
    }
    if (this.fuzzyEnabled) {
      for (const kw of this.fuzzyKeywords) {
        if (fuzzyContains(norm, kw, this.maxEditDistance)) {
          return true;
        }
      }
    }
    return false;
  }
}
