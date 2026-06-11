-- 010_user_photo.sql — Google 프로필 사진 URL(photo_url) 컬럼 추가
-- Google OAuth 로그인 사용자의 프로필 아이콘을 설정/관리자 페이지에서 표시하기 위해
-- 사진 URL을 영속화한다. 자체(local) 계정은 NULL이며 이니셜 아바타로 대체된다.
ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_url TEXT;
