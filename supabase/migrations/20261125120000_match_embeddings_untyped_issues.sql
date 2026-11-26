-- The similar-tickets hint on Request a Feature / Report a Bug narrows issues
-- with match_issue_kind ('feature' / 'bug'). It used to keep only issues of
-- exactly that kind, so every ticket without a Bug or Feature label in Linear
-- (kind null) was left out of both hints: typing an existing ticket's exact
-- title found nothing (e.g. SPA-411, no label).
--
-- Now it only leaves out the *other* kind: the feature hint skips bugs, the
-- bug hint skips features, and untyped issues show up in both. Same function
-- otherwise (20261110120000_embeddings_table.sql).

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
      -- `match_issue_kind`: keep that kind and untyped issues; only the
      -- other kind is left out.
      AND (match_issue_kind IS NULL OR iv.kind IS NULL OR iv.kind = match_issue_kind)
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

GRANT EXECUTE ON FUNCTION portal.match_embeddings(vector, text, text[], boolean, text, int) TO service_role;
