-- 005_user_name.sql — 사용자 표시 이름(name) 컬럼 추가
-- 일반 사용자는 NULL일 수 있으며, 시드된 관리자 계정은 '관리자'로 채워진다.
ALTER TABLE users ADD COLUMN IF NOT EXISTS name TEXT;

-- 기존에 시드된 관리자 계정에 이름이 없으면 '관리자'로 보정한다.
UPDATE users SET name = '관리자' WHERE is_admin = true AND name IS NULL;
