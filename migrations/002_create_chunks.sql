-- MMP RAG: chunks 테이블 생성
-- Supabase SQL Editor에서 실행

CREATE TABLE IF NOT EXISTS chunks (
  id           BIGSERIAL    PRIMARY KEY,
  document_id  BIGINT       REFERENCES documents(id) ON DELETE CASCADE,
  chunk_index  INT          NOT NULL,
  content      TEXT         NOT NULL,
  url          TEXT         NOT NULL,           -- 원문 URL (출처 표기)
  title        TEXT         NOT NULL,
  mmp_name     TEXT         CHECK (mmp_name IN ('AppsFlyer', 'Airbridge', 'Adjust')),
  embedding    VECTOR(1536),
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- 동일 문서 재수집 시 덮어쓰기용 유니크 제약
CREATE UNIQUE INDEX IF NOT EXISTS idx_chunks_doc_chunk
  ON chunks(document_id, chunk_index);

-- mmp_name 필터링 최적화
CREATE INDEX IF NOT EXISTS idx_chunks_mmp_name ON chunks(mmp_name);

-- 기존 함수 제거 후 재생성 (반환 타입 변경)
DROP FUNCTION IF EXISTS match_documents(vector, integer, text);

-- 벡터 유사도 검색 함수 (chunks 기반으로 교체)
CREATE OR REPLACE FUNCTION match_documents(
  query_embedding VECTOR(1536),
  match_count     INT   DEFAULT 5,
  filter_mmp      TEXT  DEFAULT NULL
)
RETURNS TABLE (
  id          BIGINT,
  title       TEXT,
  content     TEXT,
  url         TEXT,
  mmp_name    TEXT,
  chunk_index INT,
  similarity  FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.title,
    c.content,
    c.url,
    c.mmp_name,
    c.chunk_index,
    1 - (c.embedding <=> query_embedding) AS similarity
  FROM chunks c
  WHERE
    c.embedding IS NOT NULL
    AND (filter_mmp IS NULL OR c.mmp_name = filter_mmp)
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
