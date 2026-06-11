// MedicalKeywordDetector 단위 테스트

import { describe, expect, it } from 'vitest';

import { detectMedicalKeywords } from './MedicalKeywordDetector.js';

describe('detectMedicalKeywords', () => {
  it('빈 입력은 비-리다이렉트 결과를 반환한다', () => {
    const result = detectMedicalKeywords('');
    expect(result.isMedicalRedirect).toBe(false);
    expect(result.matchedCategories).toEqual([]);
    expect(result.matchedKeywords).toEqual([]);
  });

  it('진단명 카테고리 키워드를 감지한다', () => {
    const result = detectMedicalKeywords('제가 우울증인가요?');
    expect(result.isMedicalRedirect).toBe(true);
    expect(result.matchedCategories).toContain('diagnosis');
    expect(result.matchedKeywords).toContain('우울증');
  });

  it('약물 카테고리 키워드를 감지한다 (한글 + 영문 약어)', () => {
    const koreanResult = detectMedicalKeywords('항우울제를 먹어야 하나요?');
    expect(koreanResult.isMedicalRedirect).toBe(true);
    expect(koreanResult.matchedCategories).toContain('medication');

    const ssriUpper = detectMedicalKeywords('SSRI 처방받았어요');
    expect(ssriUpper.isMedicalRedirect).toBe(true);
    expect(ssriUpper.matchedKeywords).toContain('SSRI');
    expect(ssriUpper.matchedKeywords).toContain('처방');

    const ssriLower = detectMedicalKeywords('ssri라는 약 들어봤어요');
    expect(ssriLower.isMedicalRedirect).toBe(true);
  });

  it('치료법 카테고리 키워드를 감지한다', () => {
    const result = detectMedicalKeywords('인지행동치료를 받아야 할까요?');
    expect(result.isMedicalRedirect).toBe(true);
    expect(result.matchedCategories).toContain('treatment');
    expect(result.matchedKeywords).toContain('인지행동치료');
  });

  it('의료 키워드가 없는 정상 발화에 대해 false를 반환한다', () => {
    const result = detectMedicalKeywords('오늘 친구랑 다퉈서 마음이 무거워');
    expect(result.isMedicalRedirect).toBe(false);
    expect(result.matchedCategories).toEqual([]);
    expect(result.matchedKeywords).toEqual([]);
  });

  it('동일 키워드는 중복 없이 한 번만 보고한다', () => {
    const result = detectMedicalKeywords('우울증, 우울증, 또 우울증...');
    expect(result.matchedKeywords.filter((k) => k === '우울증').length).toBe(1);
  });

  describe('보강 키워드', () => {
    it.each([
      ['양극성장애', '제가 양극성장애일까요?'],
      ['조울증', '조울증 같다는 얘기를 들었어요'],
      ['PTSD', 'PTSD가 있다고 진단받았어요'],
      ['외상후스트레스장애', '외상후스트레스장애 검사를 받아볼까 해요'],
      ['강박장애', '강박장애가 있는 것 같아요'],
      ['OCD', 'OCD 증상이 있어요'],
      ['ADHD', 'ADHD인지 궁금해요'],
      ['주의력결핍', '주의력결핍이 의심돼요'],
      ['사회불안장애', '사회불안장애 같아요'],
      ['공포증', '고소공포증이 심해요'],
      ['섭식장애', '섭식장애를 의심하고 있어요'],
      ['거식증', '거식증인 것 같아 무서워요'],
      ['폭식증', '폭식증 증상이 있어요'],
      ['수면장애', '수면장애가 심해졌어요'],
      ['불면증', '요즘 불면증이 너무 심해요'],
      ['적응장애', '적응장애 진단을 받았어요'],
    ])('진단명 추가 키워드 %s를 감지한다', (keyword, text) => {
      const result = detectMedicalKeywords(text);
      expect(result.isMedicalRedirect).toBe(true);
      expect(result.matchedCategories).toContain('diagnosis');
      expect(result.matchedKeywords).toContain(keyword);
    });

    it.each([
      ['자낙스', '자낙스를 처방받았어요'],
      ['리탈린', '리탈린을 먹어볼까 해요'],
      ['콘서타', '콘서타라는 약을 먹어요'],
      ['프로작', '프로작을 복용 중입니다'],
      ['렉사프로', '렉사프로를 먹는 중이에요'],
      ['서트랄린', '서트랄린이라는 약을 처방받았어요'],
      ['시탈로프람', '시탈로프람 복용 중이에요'],
      ['항불안제', '항불안제를 먹어볼까 해요'],
      ['수면제', '수면제를 먹지 않으면 잠이 안 와요'],
      ['신경안정제', '신경안정제 처방을 받았어요'],
      ['처방전', '처방전을 받아왔어요'],
    ])('약물 추가 키워드 %s를 감지한다', (keyword, text) => {
      const result = detectMedicalKeywords(text);
      expect(result.isMedicalRedirect).toBe(true);
      expect(result.matchedCategories).toContain('medication');
      expect(result.matchedKeywords).toContain(keyword);
    });

    it.each([
      ['DBT', 'DBT 치료가 도움이 될까요?'],
      ['변증법행동치료', '변증법행동치료를 받아볼까 해요'],
      ['EMDR', 'EMDR 치료를 권유받았어요'],
      ['안구운동민감소실재처리', '안구운동민감소실재처리 기법이 궁금해요'],
      ['노출치료', '노출치료가 효과 있을까요?'],
      ['심리치료', '심리치료를 받아볼까 고민이에요'],
      ['심리상담', '심리상담을 받아야 할 것 같아요'],
      ['정신과 진료', '정신과 진료를 예약해야 할까요?'],
      ['정신과 약', '정신과 약을 먹는 게 맞을까요?'],
      ['입원', '입원을 권유받았어요'],
      ['외래 진료', '외래 진료를 받고 있어요'],
    ])('치료법 추가 키워드 %s를 감지한다', (keyword, text) => {
      const result = detectMedicalKeywords(text);
      expect(result.isMedicalRedirect).toBe(true);
      expect(result.matchedCategories).toContain('treatment');
      expect(result.matchedKeywords).toContain(keyword);
    });

    it('영문 약어는 대소문자에 관계없이 감지된다', () => {
      expect(detectMedicalKeywords('ptsd 증상이 있어요').isMedicalRedirect).toBe(true);
      expect(detectMedicalKeywords('adhd 검사를 받아볼까 해요').isMedicalRedirect).toBe(true);
      expect(detectMedicalKeywords('ocd 같아요').isMedicalRedirect).toBe(true);
      expect(detectMedicalKeywords('emdr 치료').isMedicalRedirect).toBe(true);
      expect(detectMedicalKeywords('dbt 그룹').isMedicalRedirect).toBe(true);
    });
  });
});
