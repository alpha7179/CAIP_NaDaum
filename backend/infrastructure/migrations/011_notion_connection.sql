-- 011_notion_connection.sql — 사용자별 노션 연결(내부 통합 토큰) 저장
-- 일기를 사용자의 노션 워크스페이스로 내보내기 위해, 사용자가 입력한 Internal
-- Integration Token과 대상 페이지(새 일기 페이지의 부모)를 사용자별로 영속화한다.
--
-- 보안: access_token은 노션 워크스페이스 쓰기 권한을 가진 secret이다.
--   NOTION_TOKEN_ENC_KEY가 설정되면 애플리케이션에서 AES-256-GCM으로 암호화하여 저장한다.
--   사용자 탈퇴 시 함께 삭제되도록 users.user_id에 ON DELETE CASCADE로 묶는다.
CREATE TABLE IF NOT EXISTS notion_connections (
  user_id           UUID PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
  access_token      TEXT NOT NULL,
  workspace_name    TEXT,
  -- 새 일기 페이지가 생성될 부모 페이지(통합에 공유된 페이지).
  target_page_id    TEXT,
  target_page_title TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
