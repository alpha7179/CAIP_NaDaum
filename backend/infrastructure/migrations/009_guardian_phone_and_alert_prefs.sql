-- =====================================================================
-- Migration: 009_guardian_phone_and_alert_prefs.sql
-- Purpose  : 보호자에 전화번호(SMS 알림용)를 추가하고, 사용자별 보호자 알림
--            채널 on/off 설정을 추가한다.
--   - guardian_contacts.phone (E.164 형식) 추가 — 이메일과 함께 보유
--   - users.alert_email_enabled / alert_sms_enabled (기본 true) 추가
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1) guardian_contacts: 전화번호(E.164) 추가
--    기존 행 호환을 위해 nullable로 추가하고, NULL 또는 E.164만 허용한다.
--    신규 등록은 애플리케이션 계층(AuthService.validateGuardianContacts)에서
--    이메일·전화 모두 필수로 검증한다.
-- ---------------------------------------------------------------------
ALTER TABLE guardian_contacts
  ADD COLUMN IF NOT EXISTS phone TEXT;

ALTER TABLE guardian_contacts
  DROP CONSTRAINT IF EXISTS guardian_contacts_phone_e164_check;

ALTER TABLE guardian_contacts
  ADD CONSTRAINT guardian_contacts_phone_e164_check
  CHECK (phone IS NULL OR phone ~ '^\+[1-9]\d{1,14}$');

-- ---------------------------------------------------------------------
-- 2) users: 보호자 알림 채널 on/off 설정 (기본 둘 다 활성)
-- ---------------------------------------------------------------------
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS alert_email_enabled BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS alert_sms_enabled BOOLEAN NOT NULL DEFAULT true;

COMMIT;
