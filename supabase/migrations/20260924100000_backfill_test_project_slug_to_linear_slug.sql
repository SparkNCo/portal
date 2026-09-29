-- tests.project_slug held the route slug (clientName) instead of
-- customers.linear_slug. Rewrites rows matching a clientName (case-insensitive)
-- to that customer's linear_slug; anything else (legacy NULLs, already-correct
-- values) is left untouched.

UPDATE portal.tests t
SET project_slug = c.linear_slug
FROM portal.customers c
WHERE c."clientName" ILIKE t.project_slug
  AND c.linear_slug IS NOT NULL
  AND c.linear_slug <> t.project_slug;
