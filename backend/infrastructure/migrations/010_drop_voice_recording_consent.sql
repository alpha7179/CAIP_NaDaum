-- =====================================================================
-- Migration: 010_drop_voice_recording_consent.sql
-- Purpose  : 음성 녹음 이용 동의 항목을 제거한다. 보호자 알림 동의
--            (guardian_notification, 008에서 추가)가 그 자리를 대신하는 필수 동의가 된다.
--   - consent_records.voice_recording 컬럼 삭제
-- 주의: 컬럼 삭제는 되돌릴 수 없다(데이터 손실). 출시 전 단계 기준.
-- =====================================================================

BEGIN;

ALTER TABLE consent_records
  DROP COLUMN IF EXISTS voice_recording;

COMMIT;
