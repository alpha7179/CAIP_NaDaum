-- 007_user_cascade.sql — users 삭제 시 자식 레코드 자동 삭제 (ON DELETE CASCADE)
--
-- 배경: 001_init.sql의 FK는 ON DELETE CASCADE가 없어, 회원 탈퇴/관리자 삭제 시
-- DELETE FROM users가 consent_records 등 자식 테이블의 FK 제약을 위반한다
-- (예: consent_records_user_id_fkey). 애플리케이션 코드(PgAuthApi/PgAdminApi)는
-- 이미 CASCADE를 가정하고 users만 삭제하므로, 제약을 CASCADE로 재정의한다.
-- safety_audit_log는 users FK가 없어(감사 보존 목적) 코드에서 명시적으로 삭제한다.

BEGIN;

ALTER TABLE consent_records   DROP CONSTRAINT IF EXISTS consent_records_user_id_fkey;
ALTER TABLE consent_records   ADD  CONSTRAINT consent_records_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE;

ALTER TABLE guardian_contacts DROP CONSTRAINT IF EXISTS guardian_contacts_user_id_fkey;
ALTER TABLE guardian_contacts ADD  CONSTRAINT guardian_contacts_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE;

ALTER TABLE diary_entries     DROP CONSTRAINT IF EXISTS diary_entries_user_id_fkey;
ALTER TABLE diary_entries     ADD  CONSTRAINT diary_entries_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE;

ALTER TABLE artifact_consents DROP CONSTRAINT IF EXISTS artifact_consents_user_id_fkey;
ALTER TABLE artifact_consents ADD  CONSTRAINT artifact_consents_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE;

ALTER TABLE artifacts         DROP CONSTRAINT IF EXISTS artifacts_user_id_fkey;
ALTER TABLE artifacts         ADD  CONSTRAINT artifacts_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE;

COMMIT;
