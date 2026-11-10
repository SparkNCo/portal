-- Refactor embeddings (step A1): every embedding in one table, several chunks
-- per object. gte-small reads only ~512 tokens, so one vector per object
-- left everything past the start of long content unsearchable; each object is
-- now split into chunks (supabase/functions/lib/chunking.ts) and each chunk
-- embedded on its own.
--
-- Only adds: documents.embedding, tests.embedding, the issue_vectors vectors
-- and match_documents / match_issues / match_tests stay until the code reads
-- from here and production has been re-embedded (cleanup step A6).

-- ---------------------------------------------------------------------------
-- The chunks
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS portal.embeddings (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  project_slug text NOT NULL,

  -- The object a chunk comes from: exactly one is set. Deleting the object
  -- deletes its chunks. Issues live in Linear; issue_vectors mirrors them.
  document_id bigint REFERENCES portal.documents(id) ON DELETE CASCADE,
  test_id uuid REFERENCES portal.tests(id) ON DELETE CASCADE,
  issue_id text REFERENCES portal.issue_vectors(id) ON DELETE CASCADE,

  source_type text GENERATED ALWAYS AS (
    CASE
      WHEN document_id IS NOT NULL THEN 'document'
      WHEN test_id IS NOT NULL THEN 'test'
      ELSE 'issue'
    END
  ) STORED,

  -- 0, 1, 2… in reading order. Issues: chunk 0 is the title alone (what
  -- short searches match against), the rest are title + description.
  chunk_index int NOT NULL CHECK (chunk_index >= 0),
  -- The chunk's own text: what AI tools quote and cite.
  content text NOT NULL,
  embedding vector(384) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT embeddings_one_source CHECK (num_nonnulls(document_id, test_id, issue_id) = 1)
);

-- One row per (object, chunk).
CREATE UNIQUE INDEX IF NOT EXISTS embeddings_document_chunk ON portal.embeddings (document_id, chunk_index) WHERE document_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS embeddings_test_chunk     ON portal.embeddings (test_id, chunk_index)     WHERE test_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS embeddings_issue_chunk    ON portal.embeddings (issue_id, chunk_index)    WHERE issue_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS embeddings_project_slug ON portal.embeddings (project_slug);
CREATE INDEX IF NOT EXISTS embeddings_embedding ON portal.embeddings USING hnsw (embedding vector_cosine_ops);

-- RLS with no policies: service role only, like issue_vectors.
ALTER TABLE portal.embeddings ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Whether all of an object's chunks are embedded. A function call has ~2 s of
-- CPU (about 1,000 words through gte-small), so a long document is embedded
-- over several calls: the first chunks when it's saved, the rest by the
-- backfill (storage/backfill-vectors, tests/backfill-vectors), which picks
-- the rows still false. Starts false for every existing row, so the first
-- backfill after this migration embeds them all into portal.embeddings.
-- ---------------------------------------------------------------------------
ALTER TABLE portal.documents ADD COLUMN IF NOT EXISTS embeddings_complete boolean NOT NULL DEFAULT false;
ALTER TABLE portal.tests ADD COLUMN IF NOT EXISTS embeddings_complete boolean NOT NULL DEFAULT false;

-- ---------------------------------------------------------------------------
-- What the global query cites about an issue, kept by the sync from Linear:
-- its identifier (e.g. SPA-123), status, due date and creation date.
-- ---------------------------------------------------------------------------
ALTER TABLE portal.issue_vectors ADD COLUMN IF NOT EXISTS identifier text;
ALTER TABLE portal.issue_vectors ADD COLUMN IF NOT EXISTS state text;
ALTER TABLE portal.issue_vectors ADD COLUMN IF NOT EXISTS due_date date;
ALTER TABLE portal.issue_vectors ADD COLUMN IF NOT EXISTS linear_created_at timestamptz;

-- ---------------------------------------------------------------------------
-- Search: each object's best chunk, best first
-- ---------------------------------------------------------------------------
-- `match_source_types`: null for every type, or e.g. '{document}'.
-- `match_title_only`: only issues' chunk 0 (their titles), for short queries.
-- `match_issue_kind`: 'bug' / 'feature' to narrow issues; null for all.
-- Always scoped by project_slug here, never by the caller's prompt.
CREATE OR REPLACE FUNCTION portal.match_embeddings(
  query_embedding vector(384),
  match_project_slug text,
  match_source_types text[] DEFAULT NULL,
  match_title_only boolean DEFAULT false,
  match_issue_kind text DEFAULT NULL,
  match_count int DEFAULT 10
)
RETURNS TABLE(
  source_type text,
  document_id bigint,
  test_id uuid,
  issue_id text,
  chunk_index int,
  content text,
  similarity float
)
LANGUAGE sql STABLE
-- `public` must be in search_path for the `<=>` operator.
SET search_path = portal, public, pg_catalog
AS $$
  WITH ranked AS (
    SELECT
      e.source_type, e.document_id, e.test_id, e.issue_id, e.chunk_index, e.content,
      1 - (e.embedding <=> query_embedding) AS similarity
    FROM portal.embeddings e
    LEFT JOIN portal.issue_vectors iv ON iv.id = e.issue_id
    WHERE e.project_slug ILIKE match_project_slug
      AND (match_source_types IS NULL OR e.source_type = ANY (match_source_types))
      AND (NOT match_title_only OR (e.issue_id IS NOT NULL AND e.chunk_index = 0))
      AND (match_issue_kind IS NULL OR iv.kind = match_issue_kind)
  ),
  -- One row per object: its best chunk, so a long document can't fill every
  -- result with its own chunks.
  best AS (
    SELECT DISTINCT ON (r.source_type, coalesce(r.document_id::text, r.test_id::text, r.issue_id)) r.*
    FROM ranked r
    ORDER BY r.source_type, coalesce(r.document_id::text, r.test_id::text, r.issue_id), r.similarity DESC
  )
  SELECT b.source_type, b.document_id, b.test_id, b.issue_id, b.chunk_index, b.content, b.similarity
  FROM best b
  ORDER BY b.similarity DESC
  LIMIT match_count;
$$;
