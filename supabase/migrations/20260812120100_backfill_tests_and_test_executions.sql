-- Backfills portal.tests_legacy (the pre-split table) into the new portal.tests +
-- portal.test_executions shape. Must run after 20260812120000_create_tests_and_test_executions.sql.
--
-- For every legacy row:
--   1. Insert one `tests` row (project_slug left NULL — see note in the create migration).
--   2. Insert one `test_executions` row referencing it, carrying over issue_id/expected/
--      status/results(actual)/audit fields.
--   3. If the legacy row's status was 'passed', point the new test's
--      last_passed_execution_id at that execution.
--
-- Safe to re-run: skips any legacy row that's already been backfilled (matched by
-- test_executions.issue_id + tests.title, since tests_legacy had no natural unique key
-- to check against directly).

DO $$
DECLARE
  legacy_row RECORD;
  new_test_id uuid;
  new_execution_id uuid;
BEGIN
  FOR legacy_row IN SELECT * FROM portal.tests_legacy LOOP
    -- Skip rows already migrated in a previous partial run.
    IF EXISTS (
      SELECT 1
      FROM portal.test_executions te
      JOIN portal.tests t ON t.id = te.test_id
      WHERE te.issue_id = legacy_row.issue_id AND t.title = legacy_row.title
    ) THEN
      CONTINUE;
    END IF;

    INSERT INTO portal.tests (project_slug, title, steps, created_by, created_at, updated_at)
    VALUES (NULL, legacy_row.title, COALESCE(legacy_row.steps, '[]'::jsonb), legacy_row.created_by, legacy_row.created_at, legacy_row.updated_at)
    RETURNING id INTO new_test_id;

    INSERT INTO portal.test_executions (test_id, issue_id, expected, status, results, created_by, approved_by, created_at, updated_at)
    VALUES (
      new_test_id,
      legacy_row.issue_id,
      legacy_row.expected,
      COALESCE(legacy_row.status, 'draft'),
      COALESCE(legacy_row.actual, '[]'::jsonb),
      legacy_row.created_by,
      legacy_row.approved_by,
      legacy_row.created_at,
      legacy_row.updated_at
    )
    RETURNING id INTO new_execution_id;

    IF legacy_row.status = 'passed' THEN
      UPDATE portal.tests SET last_passed_execution_id = new_execution_id WHERE id = new_test_id;
    END IF;
  END LOOP;
END $$;

-- portal.tests_legacy is intentionally left in place as an archive/safety net.
-- Once the new tables are verified in production, it can be dropped with:
--   DROP TABLE portal.tests_legacy;
