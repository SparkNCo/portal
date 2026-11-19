-- Each user's own screen layout, one row per user (SPA-581 and the expand
-- button on pages other than the Dashboard):
--   - nav_order: the left sidebar's menu items in the order they dragged
--     them into, by key ('dashboard', 'build', …). Items not listed keep their
--     default place, at the end (lib/user-layout.ts).
--   - expanded_panels: panels widened to the full page width on pages other
--     than the Dashboard, as 'page:panel' ('build:build_backlog'). The
--     Dashboard keeps its own in pinned_panels.full_width.
-- Room for other layout preferences later, so they don't each need a table.
--
-- Read and written by the browser with the user's own session, so access is
-- by RLS: each user sees and changes only their own row. portal.users.id is
-- not the auth user's id (they're linked by auth_id), hence
-- current_portal_user_id() rather than auth.uid().

CREATE TABLE IF NOT EXISTS portal.user_layout (
  user_id uuid PRIMARY KEY REFERENCES portal.users(id) ON DELETE CASCADE,
  nav_order text[] NOT NULL DEFAULT '{}',
  expanded_panels text[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE portal.user_layout ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_layout_select ON portal.user_layout;
CREATE POLICY user_layout_select ON portal.user_layout
  FOR SELECT USING (user_id = portal.current_portal_user_id());

DROP POLICY IF EXISTS user_layout_insert ON portal.user_layout;
CREATE POLICY user_layout_insert ON portal.user_layout
  FOR INSERT WITH CHECK (user_id = portal.current_portal_user_id());

DROP POLICY IF EXISTS user_layout_update ON portal.user_layout;
CREATE POLICY user_layout_update ON portal.user_layout
  FOR UPDATE USING (user_id = portal.current_portal_user_id())
  WITH CHECK (user_id = portal.current_portal_user_id());

-- New tables don't always get the schema's default grants (cloud).
GRANT SELECT, INSERT, UPDATE ON portal.user_layout TO authenticated;
GRANT ALL ON portal.user_layout TO service_role;
