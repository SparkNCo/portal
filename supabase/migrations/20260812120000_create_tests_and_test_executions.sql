-- Splits the old single `tests` table (one row per test case, permanently tied to
-- one Linear ticket, with every QA/UAT attempt appended into an `actual` jsonb array
-- on that same row) into two tables:
--   - `tests`: a reusable test definition (name + steps), no longer tied to one ticket.
--   - `test_executions`: one row per attachment of a test to a specific ticket
--     (expected behaviour for that ticket, status, accumulated results).
--
-- The old table is kept as `tests_legacy` (renamed, not dropped) so existing data is
-- never lost. See the companion `..._backfill_tests_and_test_executions.sql` migration,
-- which must be run immediately after this one, to copy that data into the new shape.

ALTER TABLE portal.tests RENAME TO tests_legacy;

CREATE TABLE IF NOT EXISTS portal.tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The customer/initiative this test belongs to, used to scope the "pick an existing
  -- test" autocomplete to the same customer. Nullable because tests backfilled from
  -- `tests_legacy` can't be mapped to a project_slug (that mapping only exists in
  -- Linear, not in Supabase) — those rows stay NULL and are simply excluded from the
  -- autocomplete going forward, while their history/steps/results are fully preserved.
  project_slug text,
  title text NOT NULL,
  steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- Points at whichever test_executions row is the most recent one that passed.
  -- Nullable, and the FK is added below (after test_executions exists) since the two
  -- tables reference each other.
  last_passed_execution_id uuid,
  created_by text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS portal.test_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id uuid NOT NULL REFERENCES portal.tests(id) ON DELETE CASCADE,
  issue_id text NOT NULL,
  expected text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'passed', 'failed')),
  -- Same shape as the legacy `actual` column: { text, recorded_by, recorded_at, kind: "qa"|"uat", attachments }[]
  results jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by text,
  approved_by text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE portal.tests
  ADD CONSTRAINT tests_last_passed_execution_fk
  FOREIGN KEY (last_passed_execution_id) REFERENCES portal.test_executions(id);

CREATE INDEX IF NOT EXISTS idx_tests_project_slug ON portal.tests(project_slug);
CREATE INDEX IF NOT EXISTS idx_test_executions_test_id ON portal.test_executions(test_id);
CREATE INDEX IF NOT EXISTS idx_test_executions_issue_id ON portal.test_executions(issue_id);

-- Trigram index so the "pick an existing test" autocomplete's ILIKE search stays fast
-- as the table grows.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_tests_title_trgm ON portal.tests USING gin (title gin_trgm_ops);

-- updated_at triggers, same pattern as portal.design_resources.
CREATE OR REPLACE FUNCTION portal.update_tests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_tests_updated_at
  BEFORE UPDATE ON portal.tests
  FOR EACH ROW
  EXECUTE FUNCTION portal.update_tests_updated_at();

CREATE OR REPLACE FUNCTION portal.update_test_executions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_test_executions_updated_at
  BEFORE UPDATE ON portal.test_executions
  FOR EACH ROW
  EXECUTE FUNCTION portal.update_test_executions_updated_at();
