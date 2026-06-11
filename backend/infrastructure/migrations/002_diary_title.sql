-- ---------------------------------------------------------------------
-- 002_diary_title — diary_entries.title 컬럼 추가 (일기 제목)
--
-- 일기 생성 시 10자 이하의 짧은 제목을 함께 생성·저장한다.
-- 기존 행 보존을 위해 NOT NULL DEFAULT '' 로 추가한다(빈 제목은 조회 측에서
-- 본문 파생 제목으로 폴백). 재실행 안전을 위해 IF NOT EXISTS 사용.
-- ---------------------------------------------------------------------
BEGIN;

ALTER TABLE diary_entries
  ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT '';

COMMIT;
