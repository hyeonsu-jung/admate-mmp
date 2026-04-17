-- MMP RAG: documents 테이블 생성
-- Supabase SQL Editor에서 실행

-- pgvector 확장 활성화 (RAG 임베딩용)
CREATE EXTENSION IF NOT EXISTS vector;

-- documents 테이블 생성
CREATE TABLE IF NOT EXISTS documents (
  id          BIGSERIAL PRIMARY KEY,
  title       TEXT        NOT NULL,
  content     TEXT        NOT NULL,
  url         TEXT        NOT NULL UNIQUE,
  mmp_name    TEXT        CHECK (mmp_name IN ('AppsFlyer', 'Airbridge', 'Adjust')),
  section_id  BIGINT,
  updated_at  TIMESTAMPTZ,
  crawled_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  embedding   VECTOR(1536)  -- OpenAI text-embedding-3-small 기준 (변경 시 수정)
);

-- 조회 최적화 인덱스
CREATE INDEX IF NOT EXISTS idx_documents_mmp_name ON documents(mmp_name);
CREATE INDEX IF NOT EXISTS idx_documents_crawled_at ON documents(crawled_at DESC);

-- 벡터 유사도 검색 인덱스 (IVFFlat, 데이터 적재 후 생성 권장)
-- CREATE INDEX idx_documents_embedding ON documents USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- RAG 유사도 검색 함수
CREATE OR REPLACE FUNCTION match_documents(
  query_embedding VECTOR(1536),
  match_count     INT     DEFAULT 5,
  filter_mmp      TEXT    DEFAULT NULL
)
RETURNS TABLE (
  id         BIGINT,
  title      TEXT,
  content    TEXT,
  url        TEXT,
  mmp_name   TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id,
    d.title,
    d.content,
    d.url,
    d.mmp_name,
    1 - (d.embedding <=> query_embedding) AS similarity
  FROM documents d
  WHERE
    d.embedding IS NOT NULL
    AND (filter_mmp IS NULL OR d.mmp_name = filter_mmp)
  ORDER BY d.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
