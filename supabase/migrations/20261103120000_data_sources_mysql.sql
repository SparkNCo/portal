-- Query can connect to MySQL (and MySQL-compatible servers) as well as
-- Postgres and SQL Server. Each engine has its own adapter in
-- supabase/functions/data-sources/engines.ts.

ALTER TABLE portal.data_sources DROP CONSTRAINT IF EXISTS data_sources_type_check;
ALTER TABLE portal.data_sources
  ADD CONSTRAINT data_sources_type_check CHECK (type IN ('postgres', 'sqlserver', 'mysql'));
