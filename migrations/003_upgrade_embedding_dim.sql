-- [V3.0] 임베딩 모델 3072 차원 확장 마이그레이션
-- 1. 기존 데이터 초기화 (차원 충돌 방지)
TRUNCATE TABLE chunks;

-- 2. 벡터 컬럼 차원 변경 (1536 -> 3072)
ALTER TABLE chunks ALTER COLUMN embedding TYPE VECTOR(3072);

-- 3. 검색 함수(match_documents) 고도화 (3072 차원 대응)
DROP FUNCTION IF EXISTS match_documents(vector, integer, text);
CREATE OR REPLACE FUNCTION match_documents(
  query_embedding VECTOR(3072),
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
