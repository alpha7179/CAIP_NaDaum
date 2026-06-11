-- =====================================================================
-- Migration: 001_init.sql
-- Purpose  : 초기 PostgreSQL 스키마 생성
--   - 사용자 / 동의 / 보호자 / 정서 일기 / 산출물 / 안전 감사 로그 / 고위험 키워드
--   - 인덱스 및 CHECK 제약 (감정 점수 1-10, body_type, 한국 휴대전화 정규식)
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1) users — 사용자
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  user_id UUID PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL
);

-- ---------------------------------------------------------------------
-- 2) consent_records — 동의 기록
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS consent_records (
  consent_id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(user_id),
  privacy_policy BOOLEAN NOT NULL,
  non_medical_disclaimer BOOLEAN NOT NULL,
  voice_recording BOOLEAN NOT NULL,
  granted_at TIMESTAMPTZ NOT NULL,
  withdrawn_at TIMESTAMPTZ
);

-- ---------------------------------------------------------------------
-- 3) guardian_contacts — 보호자 연락처 (선택, 0~5명)
--    MVP에서는 알림 발송이 수행되지 않으나 데이터 모델 형상은 보존한다.
--    한국 휴대전화 정규식 CHECK 제약
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS guardian_contacts (
  guardian_id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(user_id),
  name TEXT NOT NULL,
  phone TEXT NOT NULL CHECK (phone ~ '^010-\d{4}-\d{4}$'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_guardian_user ON guardian_contacts(user_id);

-- ---------------------------------------------------------------------
-- 4) diary_entries — 정서 일기
--    - body_type IN ('full','brief')
--    - 7가지 감정 점수 1~10 정수 CHECK 제약
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS diary_entries (
  diary_id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(user_id),
  session_id UUID NOT NULL,
  session_date DATE NOT NULL,
  body_type TEXT NOT NULL CHECK (body_type IN ('full', 'brief')),
  body TEXT NOT NULL,
  emotion_joy SMALLINT NOT NULL CHECK (emotion_joy BETWEEN 1 AND 10),
  emotion_sadness SMALLINT NOT NULL CHECK (emotion_sadness BETWEEN 1 AND 10),
  emotion_anger SMALLINT NOT NULL CHECK (emotion_anger BETWEEN 1 AND 10),
  emotion_anxiety SMALLINT NOT NULL CHECK (emotion_anxiety BETWEEN 1 AND 10),
  emotion_surprise SMALLINT NOT NULL CHECK (emotion_surprise BETWEEN 1 AND 10),
  emotion_disgust SMALLINT NOT NULL CHECK (emotion_disgust BETWEEN 1 AND 10),
  emotion_neutral SMALLINT NOT NULL CHECK (emotion_neutral BETWEEN 1 AND 10),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_diary_user_date ON diary_entries(user_id, session_date DESC);

-- ---------------------------------------------------------------------
-- 5) artifact_consents — 산출물별 사용자 동의
--    MVP: emotion_diary 동의는 회원가입 시 묵시적으로 부여되거나 동의 항목에 포함.
--    Phase 2: counselor_report / self_assessment 동의 추가 시 동일 스키마 사용.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS artifact_consents (
  consent_id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(user_id),
  artifact_type TEXT NOT NULL,
  granted BOOLEAN NOT NULL,
  granted_at TIMESTAMPTZ NOT NULL,
  withdrawn_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_artifact_consent_user_type ON artifact_consents(user_id, artifact_type);

-- ---------------------------------------------------------------------
-- 6) artifacts — 산출물 메타데이터
--    diary_entries를 일반화한 메타 테이블. payload_ref가 실제 산출물 ID를 참조.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS artifacts (
  artifact_id UUID PRIMARY KEY,
  artifact_type TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES users(user_id),
  session_id UUID NOT NULL,
  recipients JSONB,
  access_policy JSONB NOT NULL,
  payload_ref UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_artifacts_user_type ON artifacts(user_id, artifact_type, created_at DESC);

-- ---------------------------------------------------------------------
-- 7) safety_audit_log — 안전 감사 로그
--    payload JSONB 표준 키:
--      channel_id, attempts, fallback_channel_used, final_status,
--      attempt_timestamps, scheduled_at
--    MVP에서는 채널 어댑터가 없으므로 위험 평가·개입 표시 페이로드만 기록.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS safety_audit_log (
  audit_id UUID PRIMARY KEY,
  session_id UUID NOT NULL,
  user_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  risk_level TEXT,
  payload JSONB NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_session ON safety_audit_log(session_id, occurred_at);

-- ---------------------------------------------------------------------
-- 8) high_risk_keywords — 고위험 키워드 사전
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS high_risk_keywords (
  keyword TEXT PRIMARY KEY,
  category TEXT NOT NULL CHECK (category IN ('자살', '자해', '타해'))
);

COMMIT;
