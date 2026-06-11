-- 004_admin.sql — 관리자 플래그 추가
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;
