-- Backs the developer dashboard's "Log Hours" modal: one row per submission, tied to
-- the developer who logged it and the project (customer/initiative) it was worked on.
-- `issue_ids` is a plain array of Linear issue ids (not a join table) since a log entry
-- can span zero or more tickets and never needs to be queried from the ticket side.

CREATE TABLE IF NOT EXISTS portal.hours_logged (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- References portal.users(id), not portal.developers(id) — developers.id is a
  -- separate, independently-generated PK that no frontend/edge-function code ever
  -- reads (the users<->developers link is developers.user_id instead). What we
  -- actually have on hand at write time is profile.id from UserContext, which is
  -- portal.users.id, so that's what this FK has to point at.
  developer_id uuid NOT NULL REFERENCES portal.users(id),
  developer_email text NOT NULL,
  -- Matches the developer dashboard's own `projects` entries ({ clientName, slug }),
  -- not a Linear sub-project — this is which customer/initiative the hours were for.
  project_slug text NOT NULL,
  project_name text NOT NULL,
  hours integer NOT NULL CHECK (hours > 0),
  -- The day the hours were actually worked, chosen by the developer in the form
  -- (defaults to today, but can be backdated) — distinct from `created_at`/
  -- `updated_at`, which are just the row's own audit trail.
  worked_on date NOT NULL DEFAULT current_date,
  issue_ids text[] NOT NULL DEFAULT '{}',
  summary text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hours_logged_developer_id ON portal.hours_logged(developer_id);
CREATE INDEX IF NOT EXISTS idx_hours_logged_project_slug ON portal.hours_logged(project_slug);
CREATE INDEX IF NOT EXISTS idx_hours_logged_worked_on ON portal.hours_logged(worked_on);

-- updated_at trigger, same pattern as portal.tests / portal.test_executions.
CREATE OR REPLACE FUNCTION portal.update_hours_logged_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_hours_logged_updated_at
  BEFORE UPDATE ON portal.hours_logged
  FOR EACH ROW
  EXECUTE FUNCTION portal.update_hours_logged_updated_at();
