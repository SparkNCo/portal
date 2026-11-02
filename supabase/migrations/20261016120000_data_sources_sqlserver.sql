-- Query can connect to SQL Server (including Azure SQL Database) as well as
-- Postgres. Each engine has its own adapter in supabase/functions/data-sources/engines.ts.

ALTER TABLE portal.data_sources DROP CONSTRAINT IF EXISTS data_sources_type_check;
ALTER TABLE portal.data_sources
  ADD CONSTRAINT data_sources_type_check CHECK (type IN ('postgres', 'sqlserver'));
