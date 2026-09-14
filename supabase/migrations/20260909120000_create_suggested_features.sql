-- Backs the (upcoming) Build page "Suggested Features" row: AI-generated feature
-- ideas for a project, reviewed by the client/developer as pending/accepted/declined.
--
-- Scoped by `project_slug` (the customer/initiative's clientName-based slug), same
-- convention as portal.hours_logged — not a hard FK to a customers row, since this
-- app resolves customers by clientName/slug throughout rather than by a customers.id
-- join.
--
-- `linear_project_id`/`linear_milestone_id` are Linear's own ids (not Postgres rows),
-- so — same as portal.test_executions.issue_id — there's no FK for them either.

CREATE TABLE IF NOT EXISTS portal.suggested_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  project_slug text NOT NULL,

  linear_project_id text NOT NULL,
  linear_project_name text NOT NULL,
  -- Nullable — the AI may decide no existing milestone fits.
  linear_milestone_id text,
  linear_milestone_name text,

  title text NOT NULL,
  description text NOT NULL,

  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  -- Only set once accepted — the priority chosen in the Accept flow (not an AI
  -- decision), matching Linear's own priority labels.
  priority text CHECK (priority IN ('low', 'medium', 'high', 'urgent')),

  -- The resulting Linear issue, once accepted.
  linear_issue_id text,
  linear_issue_identifier text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_suggested_features_project_slug ON portal.suggested_features(project_slug);
CREATE INDEX IF NOT EXISTS idx_suggested_features_status ON portal.suggested_features(status);

-- updated_at trigger, same pattern as portal.tests / portal.hours_logged.
CREATE OR REPLACE FUNCTION portal.update_suggested_features_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_suggested_features_updated_at
  BEFORE UPDATE ON portal.suggested_features
  FOR EACH ROW
  EXECUTE FUNCTION portal.update_suggested_features_updated_at();
