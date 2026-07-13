CREATE TABLE IF NOT EXISTS portal.dora_branch_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  repo text NOT NULL,
  branch_name text NOT NULL,
  linear_issue_id text NOT NULL,
  branch_type text NOT NULL CHECK (branch_type IN ('feat', 'fix')),
  branch_created_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (repo, branch_name)
);

CREATE INDEX IF NOT EXISTS dora_branch_events_linear_issue_id_idx
  ON portal.dora_branch_events (linear_issue_id);
