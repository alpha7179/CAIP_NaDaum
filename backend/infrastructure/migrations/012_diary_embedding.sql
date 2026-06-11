-- ---------------------------------------------------------------------
-- 012_diary_embedding — 일기 임베딩 컬럼·인덱스 (회상 RAG 확장)
--
-- pgvector 확장을 활성화하고 `diary_entries`에 1536차원 벡터 컬럼을 추가한다.
-- 표준 임베딩 모델은 OpenAI `text-embedding-3-small`(1536차원)이며, B 의미 기반
-- 회상에서 코사인 거리(`<=>`)로 사용자 일기 유사도를 검색한다.
--
-- 본 마이그레이션 실행 환경 요구사항:
--   - PostgreSQL 12+ 그리고 `pgvector` extension 사용 가능
--     (AWS RDS PostgreSQL 15+에서는 기본 제공)
--   - 마이그레이션 실행 계정에 CREATE EXTENSION 권한 필요
--
-- 실패 시 영향 범위:
--   - 본 마이그레이션이 적용되지 않으면 `setEmbedding` UPDATE 및 `pgvector` 검색이
--     실패한다. 어댑터(ArtifactPersistencePipeline)는 이를 흡수하므로 일기 본문
--     저장은 영향을 받지 않으며, 회상은 (A) 날짜 기반만 동작하게 된다.
--
-- 인덱스 정책:
--   - IVFFlat (vector_cosine_ops, lists=100) — 일반적인 코사인 검색에 적합.
--     초기 데이터가 적은 동안에는 시퀀셜 스캔이 사용될 수 있으나, 데이터가
--     누적되면 IVFFlat 인덱스가 자동 활용된다.
-- ---------------------------------------------------------------------
BEGIN;

CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE diary_entries
  ADD COLUMN IF NOT EXISTS embedding vector(1536);

CREATE INDEX IF NOT EXISTS idx_diary_embedding_cosine
  ON diary_entries USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- 사용자 범위 의미 검색 시 임베딩 미적재 행을 빠르게 제외하기 위한 보조 인덱스.
CREATE INDEX IF NOT EXISTS idx_diary_user_with_embedding
  ON diary_entries (user_id)
  WHERE embedding IS NOT NULL;

COMMIT;
