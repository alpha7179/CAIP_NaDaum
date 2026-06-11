-- 006_user_model.sql — 사용자별 지정 AI 모델 컬럼 추가
-- 관리자가 각 사용자에게 사용할 모델을 지정한다. NULL이면 서버 기본 모델을 사용한다.
ALTER TABLE users ADD COLUMN IF NOT EXISTS assigned_model TEXT;
