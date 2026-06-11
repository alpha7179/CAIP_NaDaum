// 비의료 서비스 면책 고지 정적 콘텐츠

export const NON_MEDICAL_DISCLAIMER_CONSENT_KEY = 'non_medical_disclaimer';

export type NonMedicalDisclaimerConsentKey = typeof NON_MEDICAL_DISCLAIMER_CONSENT_KEY;

export const NON_MEDICAL_DISCLAIMER_TITLE = '비의료 서비스 안내';

export const NON_MEDICAL_DISCLAIMER_PARAGRAPHS: readonly string[] = Object.freeze([
  '「나,다움」은 일상적인 정서 자기관리와 기록을 돕기 위한 정서적 지원 서비스이며, 의료 행위가 아닙니다.',
  '본 서비스는 정신질환의 진단이나 치료, 약물 처방, 특정 치료 기법의 지시를 제공하지 않습니다. AI와의 대화는 전문 의료진의 진료, 임상 심리 상담, 또는 위기 개입을 대체할 수 없습니다.',
  '임상적 진단·치료·처방이 필요한 경우, 정신건강의학과 전문의 또는 임상심리 전문가의 상담을 받으시기 바랍니다. 즉각적인 도움이 필요한 위기 상황에서는 자살예방상담전화 1393(24시간) 또는 정신건강위기상담전화 1577-0199(24시간)로 연락하시기 바랍니다.',
  '본 안내에 동의하시면, 본 서비스가 의료 서비스가 아니라는 점을 이해하고 그에 적절한 기대를 유지하는 것에 동의하는 것으로 간주됩니다.',
]);

export const NON_MEDICAL_DISCLAIMER_BODY: string =
  NON_MEDICAL_DISCLAIMER_PARAGRAPHS.join('\n\n');

export const NON_MEDICAL_DISCLAIMER = Object.freeze({
  consentKey: NON_MEDICAL_DISCLAIMER_CONSENT_KEY,
  title: NON_MEDICAL_DISCLAIMER_TITLE,
  paragraphs: NON_MEDICAL_DISCLAIMER_PARAGRAPHS,
  body: NON_MEDICAL_DISCLAIMER_BODY,
}) satisfies {
  readonly consentKey: NonMedicalDisclaimerConsentKey;
  readonly title: string;
  readonly paragraphs: readonly string[];
  readonly body: string;
};

export type NonMedicalDisclaimer = typeof NON_MEDICAL_DISCLAIMER;
