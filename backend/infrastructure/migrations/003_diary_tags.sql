-- ---------------------------------------------------------------------
-- 003_diary_tags — diary_entries.tags 컬럼 추가 (해시태그)
--
-- 일기 생성 시 그날의 키워드 해시태그(최대 4개)를 함께 생성·저장한다.
-- 기존 행 보존을 위해 NOT NULL DEFAULT '{}' 의 TEXT 배열로 추가한다.
-- 재실행 안전을 위해 IF NOT EXISTS 사용.
-- ---------------------------------------------------------------------
BEGIN;

ALTER TABLE diary_entries
  ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}';

COMMIT;
