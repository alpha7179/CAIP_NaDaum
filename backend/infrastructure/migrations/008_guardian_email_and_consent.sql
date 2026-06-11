-- =====================================================================
-- Migration: 008_guardian_email_and_consent.sql
-- Purpose  : 보호자 연락 수단을 휴대전화 → 이메일로 전환하고,
--            보호자 알림 동의(consent) 항목을 추가한다.
--   - guardian_contacts.phone (010-XXXX-XXXX CHECK) → email (이메일 형식 CHECK)
--   - consent_records.guardian_notification BOOLEAN 추가 (기본 false)
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1) guardian_contacts: phone → email
--    기존 한국 휴대전화 CHECK 제약을 제거한 뒤 컬럼명을 변경하고,
--    이메일 형식 CHECK 제약을 새로 추가한다.
-- ---------------------------------------------------------------------
ALTER TABLE guardian_contacts
  DROP CONSTRAINT IF EXISTS guardian_contacts_phone_check;

ALTER TABLE guardian_contacts
  RENAME COLUMN phone TO email;

ALTER TABLE guardian_contacts
  ADD CONSTRAINT guardian_contacts_email_check
  CHECK (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$');

-- ---------------------------------------------------------------------
-- 2) consent_records: 보호자 알림 동의 항목 추가
--    선택 항목이므로 기존 행에는 기본값 false를 적용한다.
-- ---------------------------------------------------------------------
ALTER TABLE consent_records
  ADD COLUMN IF NOT EXISTS guardian_notification BOOLEAN NOT NULL DEFAULT false;

COMMIT;
