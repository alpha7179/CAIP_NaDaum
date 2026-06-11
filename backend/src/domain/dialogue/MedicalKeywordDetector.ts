// 의료 키워드 감지기

const DIAGNOSIS_KEYWORDS: readonly string[] = [
  '우울증',
  '불안장애',
  '조현병',
  '공황장애',
  '양극성장애',
  '조울증',
  'PTSD',
  '외상후스트레스장애',
  '강박장애',
  'OCD',
  'ADHD',
  '주의력결핍',
  '사회불안장애',
  '공포증',
  '섭식장애',
  '거식증',
  '폭식증',
  '수면장애',
  '불면증',
  '적응장애',
] as const;

const MEDICATION_KEYWORDS: readonly string[] = [
  '항우울제',
  '리튬',
  '벤조디아제핀',
  'SSRI',
  '약물 복용',
  '약물복용',
  '처방',
  '자낙스',
  '리탈린',
  '콘서타',
  '프로작',
  '렉사프로',
  '서트랄린',
  '시탈로프람',
  '항불안제',
  '수면제',
  '신경안정제',
  '안정제',
  '벤조',
  '처방전',
] as const;

const TREATMENT_KEYWORDS: readonly string[] = [
  'CBT',
  '인지행동치료',
  '약물치료',
  '입원치료',
  'DBT',
  '변증법행동치료',
  'EMDR',
  '안구운동민감소실재처리',
  '노출치료',
  '심리치료',
  '심리상담',
  '정신과 진료',
  '정신과 약',
  '정신과 처방',
  '입원',
  '외래 진료',
] as const;

export type MedicalKeywordCategory = 'diagnosis' | 'medication' | 'treatment';

export const MEDICAL_KEYWORD_DICTIONARY: Readonly<
  Record<MedicalKeywordCategory, readonly string[]>
> = {
  diagnosis: DIAGNOSIS_KEYWORDS,
  medication: MEDICATION_KEYWORDS,
  treatment: TREATMENT_KEYWORDS,
};

export interface MedicalKeywordDetection {
  isMedicalRedirect: boolean;
  matchedCategories: MedicalKeywordCategory[];
  matchedKeywords: string[];
}

function normalize(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function containsKeyword(haystack: string, needle: string): boolean {
  if (haystack.includes(needle)) {
    return true;
  }
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

export function detectMedicalKeywords(userText: string): MedicalKeywordDetection {
  const empty: MedicalKeywordDetection = {
    isMedicalRedirect: false,
    matchedCategories: [],
    matchedKeywords: [],
  };

  if (!userText) {
    return empty;
  }

  const normalized = normalize(userText);
  if (normalized.length === 0) {
    return empty;
  }

  const matchedCategories = new Set<MedicalKeywordCategory>();
  const matchedKeywords: string[] = [];
  const seenKeywords = new Set<string>();

  for (const category of Object.keys(MEDICAL_KEYWORD_DICTIONARY) as MedicalKeywordCategory[]) {
    const keywords = MEDICAL_KEYWORD_DICTIONARY[category];
    for (const keyword of keywords) {
      if (containsKeyword(normalized, keyword) && !seenKeywords.has(keyword)) {
        matchedCategories.add(category);
        matchedKeywords.push(keyword);
        seenKeywords.add(keyword);
      }
    }
  }

  return {
    isMedicalRedirect: matchedKeywords.length > 0,
    matchedCategories: Array.from(matchedCategories),
    matchedKeywords,
  };
}
