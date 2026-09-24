-- portal.tests.project_slug was always written as the frontend's raw,
-- clientName-based route slug (e.g. "spark-portal") instead of the
-- customer's real Linear Initiative id (customers.linear_slug, e.g.
-- "f12c1e4fa44b") — issues and documents resolve that distinction
-- correctly, tests never did. supabase/functions/tests/index.ts now
-- resolves it server-side for every request going forward (create, update,
-- search, and the vector namespace used by resolveVectorProvider), but
-- existing rows are still stored under the wrong value — left alone, they'd
-- become invisible to "pick an existing test" / the similar-tests hint the
-- moment that fix ships, since those now look up by the real linear_slug.
--
-- Backfills every row whose project_slug currently matches a customer's
-- clientName (case-insensitive) over to that customer's linear_slug
-- instead. A row whose project_slug doesn't match any clientName is left
-- untouched — either it's a legacy/unscoped row (see
-- 20260812120000_create_tests_and_test_executions.sql's own note on
-- tests_legacy having no project_slug at all) or it already holds a real
-- linear_slug (e.g. from a customer whose clientName and linear_slug
-- happen to be the same string), in which case there's nothing to fix.

UPDATE portal.tests t
SET project_slug = c.linear_slug
FROM portal.customers c
WHERE c."clientName" ILIKE t.project_slug
  AND c.linear_slug IS NOT NULL
  AND c.linear_slug <> t.project_slug;
