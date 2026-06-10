ALTER TABLE decisions
  ADD COLUMN IF NOT EXISTS decision    text,
  ADD COLUMN IF NOT EXISTS decision_by text,
  ADD COLUMN IF NOT EXISTS decided_at  timestamptz;
