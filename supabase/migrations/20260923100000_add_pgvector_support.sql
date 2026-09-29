-- pgvector as a per-customer alternative to Upstash (customers.systems.vector);
-- lib/vector.ts picks the provider per call. Embeddings: Supabase.ai gte-small (384 dims).

CREATE EXTENSION IF NOT EXISTS vector;

-- ---------------------------------------------------------------------------
-- Documents
-- ---------------------------------------------------------------------------
ALTER TABLE portal.documents ADD COLUMN IF NOT EXISTS embedding vector(384);

CREATE INDEX IF NOT EXISTS idx_documents_embedding
  ON portal.documents USING hnsw (embedding vector_cosine_ops);

CREATE OR REPLACE FUNCTION portal.match_documents(
  query_embedding vector(384),
  match_project_slug text,
  match_count int DEFAULT 20
)
RETURNS TABLE(id bigint, similarity float)
LANGUAGE sql STABLE
-- `public` must be in search_path for the `<=>` operator, or you get
-- "operator does not exist: public.vector <=> public.vector".
SET search_path = portal, public, pg_catalog
AS $$
  SELECT d.id, 1 - (d.embedding <=> query_embedding) AS similarity
  FROM portal.documents d
  WHERE d.embedding IS NOT NULL AND d.project_slug ILIKE match_project_slug
  ORDER BY d.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- ---------------------------------------------------------------------------
-- Issues live in Linear, so this is a dedicated index table (one row per issue).
-- Two embeddings: title-only for short queries, title+description otherwise
-- (see TITLE_ONLY_QUERY_MAX_LENGTH in lib/vector.ts).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS portal.issue_vectors (
  id text PRIMARY KEY,
  project_slug text NOT NULL,
  title text NOT NULL,
  kind text CHECK (kind IN ('bug', 'feature') OR kind IS NULL),
  title_embedding vector(384),
  combined_embedding vector(384),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_issue_vectors_project_slug ON portal.issue_vectors(project_slug);
CREATE INDEX IF NOT EXISTS idx_issue_vectors_title_embedding
  ON portal.issue_vectors USING hnsw (title_embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_issue_vectors_combined_embedding
  ON portal.issue_vectors USING hnsw (combined_embedding vector_cosine_ops);

-- RLS with no policies: service role only.
ALTER TABLE portal.issue_vectors ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION portal.match_issues(
  query_embedding vector(384),
  match_project_slug text,
  match_kind text DEFAULT NULL,
  use_title_only boolean DEFAULT false,
  match_count int DEFAULT 3
)
RETURNS TABLE(id text, title text, kind text, similarity float)
LANGUAGE sql STABLE
SET search_path = portal, public, pg_catalog
AS $$
  SELECT
    v.id,
    v.title,
    v.kind,
    1 - ((CASE WHEN use_title_only THEN v.title_embedding ELSE v.combined_embedding END) <=> query_embedding) AS similarity
  FROM portal.issue_vectors v
  WHERE v.project_slug ILIKE match_project_slug
    AND (match_kind IS NULL OR v.kind = match_kind)
    AND (CASE WHEN use_title_only THEN v.title_embedding ELSE v.combined_embedding END) IS NOT NULL
  ORDER BY (CASE WHEN use_title_only THEN v.title_embedding ELSE v.combined_embedding END) <=> query_embedding
  LIMIT match_count;
$$;

-- ---------------------------------------------------------------------------
-- Test cases — portal.tests already exists.
-- ---------------------------------------------------------------------------
ALTER TABLE portal.tests ADD COLUMN IF NOT EXISTS embedding vector(384);

CREATE INDEX IF NOT EXISTS idx_tests_embedding
  ON portal.tests USING hnsw (embedding vector_cosine_ops);

CREATE OR REPLACE FUNCTION portal.match_tests(
  query_embedding vector(384),
  match_project_slug text,
  match_count int DEFAULT 3
)
RETURNS TABLE(id uuid, title text, similarity float)
LANGUAGE sql STABLE
SET search_path = portal, public, pg_catalog
AS $$
  SELECT t.id, t.title, 1 - (t.embedding <=> query_embedding) AS similarity
  FROM portal.tests t
  WHERE t.embedding IS NOT NULL AND t.project_slug ILIKE match_project_slug
  ORDER BY t.embedding <=> query_embedding
  LIMIT match_count;
$$;
