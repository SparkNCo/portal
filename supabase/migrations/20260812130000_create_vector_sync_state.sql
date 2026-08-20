-- Per-customer checkpoint for the linear-vector-sync cron (supabase/functions/linear-vector-sync/),
-- which pulls Linear issues updated since the last run and upserts them into the
-- Upstash issues vector index. Deliberately its own table rather than reusing
-- portal.dora_metrics.last_called — that column tracks a different cron's progress,
-- and conflating the two would make both jobs' checkpoints wrong.
CREATE TABLE IF NOT EXISTS portal.vector_sync_state (
  linear_slug text PRIMARY KEY,
  last_synced_at timestamptz,
  updated_at timestamptz DEFAULT now()
);

CREATE OR REPLACE FUNCTION portal.update_vector_sync_state_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_vector_sync_state_updated_at
  BEFORE UPDATE ON portal.vector_sync_state
  FOR EACH ROW
  EXECUTE FUNCTION portal.update_vector_sync_state_updated_at();
