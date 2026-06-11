-- =====================================================================
-- Migration: 011_guardian_relationship_and_channels.sql
-- Purpose  : 보호자에 관계(선택)와 보호자별 알림 채널 on/off를 추가한다.
--   - guardian_contacts.relationship  TEXT (선택)
--   - guardian_contacts.email_enabled BOOLEAN NOT NULL DEFAULT true
--   - guardian_contacts.sms_enabled   BOOLEAN NOT NULL DEFAULT true
-- =====================================================================

BEGIN;

ALTER TABLE guardian_contacts
  ADD COLUMN IF NOT EXISTS relationship TEXT;

ALTER TABLE guardian_contacts
  ADD COLUMN IF NOT EXISTS email_enabled BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE guardian_contacts
  ADD COLUMN IF NOT EXISTS sms_enabled BOOLEAN NOT NULL DEFAULT true;

COMMIT;
