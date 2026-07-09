ALTER TABLE portal.developers
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS tech_stack text[] NOT NULL DEFAULT '{}';
