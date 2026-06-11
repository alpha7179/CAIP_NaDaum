// 사전 정의된 상담 기관 연락처 정적 데이터

// 단일 상담 기관 연락처 항목
export interface CounselingReferral {
  id: string;
  name: string;
  phone: string;
  description?: string;
  url?: string;
}

export const COUNSELING_REFERRALS: readonly CounselingReferral[] = Object.freeze([
  {
    id: 'mental-health-welfare-center',
    name: '정신건강복지센터',
    phone: '1577-0199',
    description:
      '전국 광역·기초 정신건강복지센터로 연결되는 24시간 정신건강 상담 대표번호입니다. 거주 지역의 상담 자원을 안내받을 수 있습니다.',
    url: 'https://www.ncmh.go.kr/',
  },
  {
    id: 'youth-counseling-1388',
    name: '청소년상담1388',
    phone: '1388',
    description:
      '청소년·보호자·교사 누구나 이용할 수 있는 24시간 상담 핫라인입니다. 전화·문자·채팅 상담을 운영합니다.',
    url: 'https://www.1388.go.kr/',
  },
  {
    id: 'kcounselors-helpcall',
    name: '한국상담심리학회 헬프콜',
    phone: '02-538-3072',
    description:
      '한국상담심리학회가 운영하는 일반인 대상 심리상담 안내 창구입니다. 자격을 갖춘 상담심리사를 안내받을 수 있습니다.',
    url: 'https://krcpa.or.kr/',
  },
  {
    id: 'kca-counseling',
    name: '한국상담학회',
    phone: '02-3461-9094',
    description:
      '한국상담학회는 인증 전문상담사와 회원 상담기관을 안내합니다. 거주 지역과 호소 영역에 맞는 상담사를 검색할 수 있습니다.',
    url: 'https://counselors.or.kr/',
  },
  {
    id: 'korea-eap',
    name: '한국EAP협회',
    phone: '02-2038-8633',
    description:
      '직장인 대상 근로자지원프로그램(EAP)을 통해 직무 스트레스·관계 어려움에 대한 단기 상담을 안내합니다.',
    url: 'https://www.keapa.or.kr/',
  },
  {
    id: 'youth-cyber-counseling',
    name: '청소년사이버상담센터',
    phone: '1388',
    description:
      '청소년 전용 채팅·게시판·이메일 상담을 24시간 제공합니다. 1388 단축 다이얼과 동일한 통합 자원입니다.',
    url: 'https://www.cyber1388.kr/',
  },
  {
    id: 'womens-hotline-1366',
    name: '여성긴급전화 1366',
    phone: '1366',
    description:
      '가정폭력·성폭력·디지털성범죄 등 위기 상황의 여성과 가족을 위한 24시간 상담 핫라인입니다.',
    url: 'https://women1366.kr/',
  },
  {
    id: 'work-stress-1577-3500',
    name: '근로자건강센터 마음건강 상담',
    phone: '1577-3500',
    description:
      '직장 내 스트레스·번아웃 등에 대해 근로자건강센터의 마음건강 상담 자원을 안내합니다.',
    url: 'https://www.kosha.or.kr/',
  },
]);

export function findCounselingReferral(id: string): CounselingReferral | undefined {
  return COUNSELING_REFERRALS.find((item) => item.id === id);
}
