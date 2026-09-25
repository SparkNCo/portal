-- SPA-513-Cycle20: "Supabase has built in vector support... use that instead
-- of upstash" — but per-customer opt-in (customers.systems.vector, added
-- back in 20260921120000 with 'upstash' | 'pgvector' already reserved in its
-- CHECK constraint, same pattern as systems.chat's cometchat/
-- supabase_realtime switch), not a wholesale replacement. Both providers
-- stay live side by side; supabase/functions/lib/vector.ts picks between
-- them per call based on that column.
--
-- Embeddings are generated with Supabase Edge Functions' built-in
-- `Supabase.ai.Session('gte-small')` model (384 dimensions) — no external
-- embedding API/key needed, matching "built in" in the ticket.

CREATE EXTENSION IF NOT EXISTS vector;

-- ---------------------------------------------------------------------------
-- Documents — portal.documents already exists (see
-- 20260812.. and the SPA-513-Cycle20 AI-search work), just needs the column.
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
-- `vector` (and its `<=>` operator) installs into `public` by default —
-- excluding it from search_path here is what "operator does not exist:
-- public.vector <=> public.vector" means, even with the type itself
-- resolving fine (it's already bound at the column definition).
SET search_path = portal, public, pg_catalog
AS $$
  SELECT d.id, 1 - (d.embedding <=> query_embedding) AS similarity
  FROM portal.documents d
  WHERE d.embedding IS NOT NULL AND d.project_slug ILIKE match_project_slug
  ORDER BY d.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- ---------------------------------------------------------------------------
-- Issues — unlike documents/tests, issues have no table of their own in this
-- database (they live in Linear; everything else here only ever stores a
-- Linear issue id as an opaque text FK). pgvector needs a real column on a
-- real table, so this is a purpose-built index table, not a shadow of
-- anything — one row per vectorized issue, holding just enough (title,
-- kind, both embedding variants) to serve a similarity query and resolve
-- the match back to its real Linear issue by id.
--
-- Two embedding columns (not two rows like the Upstash side's ":title"
-- suffix trick) for the same reason queryTopIssueMatches picks between a
-- title-only and a title+description vector depending on query length (see
-- lib/vector.ts) — a short query's embedding sits much closer to another
-- short title than to a long combined vector's averaged-out embedding.
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

-- Only ever read/written by edge functions via the service-role client
-- (same as portal.events — see 20260922120000) — RLS enabled with no
-- policies locks it to service role, nothing for a client-side query to
-- accidentally hit.
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
