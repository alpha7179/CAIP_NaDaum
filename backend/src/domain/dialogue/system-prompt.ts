// 시스템 프롬프트 빌더

import type {
  ConversationStage,
  EmotionAnalysisResult,
  EmotionScores,
  Exchange,
} from '@nadaum/shared';
import { EMOTION_CATEGORIES } from '@nadaum/shared';

import type { RecalledDiary } from '../diary/recall/types.js';

export const SYSTEM_PROMPT_RECENT_EXCHANGES_LIMIT = 10;

export interface BuildSystemPromptArgs {
  stage: ConversationStage;
  latestEmotion?: EmotionAnalysisResult;
  recentExchanges: Exchange[];
  isMedicalRedirect: boolean;
  recalledDiaries?: RecalledDiary[];
}

const ROLE_SECTION = `[역할]
당신은 사용자의 감정을 되비추는 공감형 정서 동반자입니다. 「나,다움」은 의료 행위가 아닌 정서적 지원과 기록을 제공하는 비의료 서비스입니다.`;

const PROHIBITION_SECTION = `[금지 행위]
- 의학적 진단명을 사용자에게 부여하거나 단정하지 않습니다 (예: "당신은 우울증입니다").
- 약물 복용을 권고하거나 특정 약물 정보를 제공하지 않습니다.
- 특정 치료 기법(인지행동치료(CBT), 약물치료, 입원치료 등)을 직접 지시하거나 처방하지 않습니다.
- 의학적 소견·치료 처방·진단 확정을 제공하지 않습니다.
이 금지 사항은 모든 응답에서 예외 없이 지켜집니다.`;

const REQUIRED_BEHAVIOR_SECTION = `[필수 행동]
- 사용자가 표현한 감정을 한 번 부드럽게 되비춥니다(공감 반영).
- 사용자가 자신의 감정과 생각을 더 탐색할 수 있도록 개방형 질문 1개로 응답을 마무리합니다.
- 응답 전체 길이는 2-4문장으로 유지하여 사용자 발화의 흐름을 끊지 않습니다.
- 판단·평가·해결책 강요 대신, 사용자의 경험을 인정하고 곁에 머무르는 어조를 유지합니다.`;

const STAGE_GUIDANCE: Readonly<Record<ConversationStage, string>> = {
  상황파악: '사용자가 지금 마주한 상황과 맥락을 부드럽게 확인하는 단계입니다. 무엇이 있었는지 살펴봅니다.',
  감정탐색: '사용자가 그 상황에서 어떤 감정을 느꼈는지 함께 짚어보는 단계입니다. 감정의 이름과 강도를 천천히 탐색합니다.',
  생각탐색: '그 감정이 떠오를 때 함께 스쳐간 생각을 살펴보는 단계입니다. 사용자의 해석을 존중하며 따라갑니다.',
  패턴연결: '오늘의 감정·생각이 평소의 흐름과 어떻게 연결되는지 사용자가 스스로 알아채도록 돕는 단계입니다.',
  부드러운마무리:
    '대화를 따뜻하게 마무리하는 단계입니다. 오늘 나눈 이야기를 짧게 요약하고, 사용자가 자신을 돌볼 수 있도록 격려합니다.',
};

const MEDICAL_REDIRECT_SECTION = `[의료 키워드 감지 분기 — 활성]
사용자 발화에서 의학적 진단명·약물·치료법 관련 키워드가 감지되었습니다.
이번 응답에서는 다음 원칙을 반드시 따릅니다:
- 진단·약물·치료에 대한 어떤 의학적 소견도 제공하지 않습니다.
- 본 서비스가 정서적 지원과 기록을 위한 비의료 서비스임을 부드럽게 안내합니다.
- 전문 정신건강 상담 기관 또는 의료 전문가와의 상담을 권유합니다.
- 이러한 안내 후에도 사용자의 감정을 한 번 짧게 인정하고 개방형 질문 1개로 마무리합니다.`;

const MEDICAL_REDIRECT_INACTIVE_SECTION = `[의료 키워드 감지 분기 — 비활성]
이번 발화에서 의료 키워드가 감지되지 않았습니다. 일반 대화 흐름을 따릅니다.`;

function formatEmotionScores(scores: EmotionScores): string {
  return EMOTION_CATEGORIES.map((cat) => `${cat}=${scores[cat]}`).join(', ');
}

function buildLatestEmotionSection(latestEmotion?: EmotionAnalysisResult): string {
  if (!latestEmotion) {
    return `[최근 감정 분석]
직전 발화에 대한 감정 분석 결과가 아직 없습니다.`;
  }

  const scoresLine = formatEmotionScores(latestEmotion.scores);
  const distortionsLine =
    latestEmotion.distortions.length > 0
      ? latestEmotion.distortions.join(', ')
      : '감지된 인지 왜곡 패턴 없음';

  return `[최근 감정 분석]
- 7가지 감정 점수 (1-10 정수): ${scoresLine}
- 인지 왜곡 패턴: ${distortionsLine}`;
}

function takeLast<T>(arr: readonly T[], n: number): T[] {
  if (n <= 0 || arr.length === 0) {
    return [];
  }
  if (arr.length <= n) {
    return arr.slice();
  }
  return arr.slice(arr.length - n);
}

function formatExchangeLine(ex: Exchange): string {
  const speaker = ex.role === 'user' ? '사용자' : 'AI';
  const safeText = ex.text.replace(/\r?\n+/g, ' ').trim();
  return `- ${speaker}: ${safeText}`;
}

function buildRecentExchangesSection(recentExchanges: Exchange[]): string {
  const recent = takeLast(recentExchanges, SYSTEM_PROMPT_RECENT_EXCHANGES_LIMIT);

  if (recent.length === 0) {
    return `[대화 이력 — 최근 ${SYSTEM_PROMPT_RECENT_EXCHANGES_LIMIT}개 이내]
세션 시작 직후로 직전 대화 이력이 없습니다.`;
  }

  const lines = recent.map(formatExchangeLine).join('\n');
  return `[대화 이력 — 최근 ${SYSTEM_PROMPT_RECENT_EXCHANGES_LIMIT}개 이내]
${lines}`;
}

const RECALL_BODY_PREVIEW_LIMIT = 200;

function previewBody(body: string): string {
  const flat = body.replace(/\r?\n+/g, ' ').trim();
  if (flat.length <= RECALL_BODY_PREVIEW_LIMIT) {
    return flat;
  }
  return `${flat.slice(0, RECALL_BODY_PREVIEW_LIMIT)}…`;
}

function buildRecalledDiariesSection(recalled: RecalledDiary[] | undefined): string {
  if (recalled === undefined || recalled.length === 0) {
    return '';
  }
  const lines = recalled
    .map((r) => {
      const tags = r.diary.tags.length > 0 ? ` (${r.diary.tags.join(', ')})` : '';
      const title = r.diary.title.trim().length > 0 ? r.diary.title.trim() : '(제목 없음)';
      return `- [${r.diary.sessionDate}] ${title}${tags}: ${previewBody(r.diary.body)}`;
    })
    .join('\n');
  return `[과거 일기 회상]
사용자가 과거의 이야기를 언급했습니다. 아래는 관련된 과거 정서 일기입니다. 사용자가
직접 꺼낸 기억이므로 부드럽게 참조해 연결하되, 일기 내용을 단정적으로 분석·진단하지
않습니다. 사용자가 묻지 않은 과거 사실을 임의로 단언하지 않습니다.
${lines}`;
}

function buildStageSection(stage: ConversationStage): string {
  const guidance = STAGE_GUIDANCE[stage];
  return `[현재 단계]
${stage} — ${guidance}`;
}

function buildMedicalSection(isMedicalRedirect: boolean): string {
  return isMedicalRedirect ? MEDICAL_REDIRECT_SECTION : MEDICAL_REDIRECT_INACTIVE_SECTION;
}

export function buildSystemPrompt(args: BuildSystemPromptArgs): string {
  const { stage, latestEmotion, recentExchanges, isMedicalRedirect, recalledDiaries } = args;

  const sections = [
    ROLE_SECTION,
    PROHIBITION_SECTION,
    REQUIRED_BEHAVIOR_SECTION,
    buildStageSection(stage),
    buildLatestEmotionSection(latestEmotion),
    buildRecentExchangesSection(recentExchanges),
    buildRecalledDiariesSection(recalledDiaries),
    buildMedicalSection(isMedicalRedirect),
  ];

  return sections.filter((s) => s.length > 0).join('\n\n');
}
