-- Who asked for each ticket created from the portal (bug report, feature
-- request, accepted suggested feature). Linear only knows the workspace's
-- API key created it, so the ticket header reads this to show
-- "Requested by <name> on <date>". Tickets with no row were created directly
-- in Linear ("Created by Spark & Co").

CREATE TABLE IF NOT EXISTS portal.issue_requests (
  -- Linear issue id.
  issue_id text PRIMARY KEY,
  requested_by uuid REFERENCES portal.users(id) ON DELETE SET NULL,
  -- Kept so the name can still be shown if the user row is removed.
  requested_by_email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Only edge functions (service role) read and write it.
ALTER TABLE portal.issue_requests ENABLE ROW LEVEL SECURITY;
