ALTER TABLE portal.dora_branch_events
  ADD COLUMN IF NOT EXISTS version smallint NOT NULL DEFAULT 1;
