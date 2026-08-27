-- Freezes each roadmap milestone's status for a cycle once that cycle closes.
-- Project Timeline used to color every cycle bucket a milestone spans with
-- that milestone's single *current* Linear status (unstarted/next/overdue/
-- done) — so a milestone that's overdue today painted every past cycle red
-- too, even ones where it was on track back then, since an issue's state
-- always reflects its current value, never what it was while a given cycle
-- was active. This table lets closed cycles keep the status they actually
-- had at close time, independent of what happens to those issues afterward.
--
-- Insert-only: written once by the milestone-snapshots cron (see
-- supabase/functions/milestone-snapshots/) shortly after a cycle closes, and
-- never updated afterward — that's the whole point, it's a frozen snapshot.
-- Only "done"/"overdue" are meaningful outcomes here since a cycle is only
-- ever snapshotted after it has already closed (see
-- computeClosedCycleStatus in the milestone-snapshots function) — an
-- active/future cycle has nothing to freeze yet and is still derived live
-- (see getBucketMilestoneStatus in components/roadmap/ProjectSummaryBar.tsx).
CREATE TABLE IF NOT EXISTS portal.milestone_cycle_snapshots (
  milestone_id text NOT NULL,
  cycle_id     text NOT NULL,
  linear_slug  text NOT NULL,
  status       text NOT NULL CHECK (status IN ('done', 'overdue')),
  captured_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (milestone_id, cycle_id)
);

CREATE INDEX IF NOT EXISTS idx_milestone_cycle_snapshots_linear_slug
  ON portal.milestone_cycle_snapshots(linear_slug);
