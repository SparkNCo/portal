ALTER TABLE portal.dora_branch_events
  ADD COLUMN IF NOT EXISTS closed_date timestamptz;
