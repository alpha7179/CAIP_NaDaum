-- =====================================================================
-- Migration: 012_diary_peak_risk.sql
-- Purpose  : 일기 작성 당시 세션의 최고(peak) 위험 수준을 일기 행에 기록한다.
--   - diary_entries.peak_risk_level TEXT NOT NULL DEFAULT '저위험'
--     CHECK (peak_risk_level IN ('저위험', '중위험', '고위험'))
--   기존 행은 보수적으로 '저위험'으로 채운다(과거 일기는 차단 대상이 아님).
-- 사용처: 프론트엔드 공유 게이트(고위험 일기 외부 공유 차단 경고 모달).
-- =====================================================================

BEGIN;

ALTER TABLE diary_entries
  ADD COLUMN IF NOT EXISTS peak_risk_level TEXT NOT NULL DEFAULT '저위험'
    CHECK (peak_risk_level IN ('저위험', '중위험', '고위험'));

COMMIT;
