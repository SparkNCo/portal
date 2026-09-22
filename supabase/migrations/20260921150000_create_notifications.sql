-- Notification bell: one row per recipient per event (chat message, decision
-- requested/answered, demo uploaded, design resource added). A single event
-- fans out into N rows (one per recipient) rather than an event+audience
-- join table, since the bell only ever needs "my unread notifications" —
-- exactly what this shape answers with one indexed query, no join.
--
-- Populated two different ways depending on where the underlying event is
-- written:
--   - Chat messages are inserted directly by the browser (see
--     components/chat/Realtime/useRealtimeMessages.ts), so a trigger below
--     fans them out to the chat's other participants — no client INSERT
--     grant on notifications is needed or given.
--   - Decisions/demos/design resources are written by edge functions
--     (service role, bypasses RLS), which insert the recipient rows
--     themselves once they've resolved who's assigned to that project.

CREATE TABLE IF NOT EXISTS portal.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Recipient. Deleting a user drops their own notifications with them.
  user_id uuid NOT NULL REFERENCES portal.users(id) ON DELETE CASCADE,

  -- Who/what triggered it. actor_user_id is nullable (system/AI-authored
  -- events have no portal.users row); actor_email is kept alongside it so
  -- the bell can still show *something* human-readable even then.
  actor_user_id uuid REFERENCES portal.users(id),
  actor_email text,

  -- e.g. 'chat_message', 'decision_requested', 'decision_answered',
  -- 'demo_uploaded', 'design_resource_added'.
  action text NOT NULL,
  -- e.g. 'chat', 'issue_decision', 'demo', 'design_resource'.
  object_type text NOT NULL,
  -- The underlying row's id (chat_id, decision id, demo_videos id,
  -- design_resources id) — opaque here, interpreted by the frontend
  -- alongside `link`.
  object_id text NOT NULL,
  -- Short content preview (message body, decision question, demo/design
  -- title) — not required by the ticket, but an empty-looking bell item
  -- list isn't useful; kept nullable since not every event has one.
  preview text,
  -- Where clicking the notification navigates to.
  link text NOT NULL,

  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON portal.notifications(user_id, created_at DESC)
  WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON portal.notifications(user_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
-- Same reasoning as portal.chats/portal.messages: the bell reads/subscribes
-- directly from the browser, so RLS has to actually scope it — matched by
-- email for the same reason (see 20260921140000_fix_chat_rls_match_by_email.sql):
-- portal.users.auth_id is unpopulated in practice, email is what every other
-- caller-identity check in this app actually uses.

ALTER TABLE portal.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY notifications_select ON portal.notifications
  FOR SELECT USING (user_id = portal.current_portal_user_id());

-- Marking as read is the only client-side write — no INSERT policy, so
-- notifications can only ever be created server-side (service role) or by
-- the trigger below (SECURITY DEFINER, bypasses RLS on its own).
CREATE POLICY notifications_update_own ON portal.notifications
  FOR UPDATE USING (user_id = portal.current_portal_user_id())
  WITH CHECK (user_id = portal.current_portal_user_id());

GRANT SELECT, UPDATE ON portal.notifications TO authenticated;

ALTER PUBLICATION supabase_realtime ADD TABLE portal.notifications;

-- ---------------------------------------------------------------------------
-- Chat message -> notification fan-out
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION portal.notify_chat_message()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO portal.notifications (user_id, actor_user_id, actor_email, action, object_type, object_id, preview, link)
  SELECT
    cp.user_id,
    NEW.user_id,
    (SELECT email FROM portal.users WHERE id = NEW.user_id),
    'chat_message',
    'chat',
    NEW.chat_id::text,
    left(NEW.body, 140),
    -- A generic fallback, not a deep link to this specific conversation —
    -- the chat pages have no "open chat <id> from a URL" support yet
    -- (separate gap; the frontend NotificationBell resolves the real,
    -- role-prefixed inbox path for `object_type = 'chat'` at click time,
    -- since only it reliably knows the viewer's role/slug, not this
    -- trigger).
    '/chat'
  FROM portal.chat_participants cp
  WHERE cp.chat_id = NEW.chat_id
    AND cp.user_id IS DISTINCT FROM NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = portal, pg_catalog;

CREATE TRIGGER notify_chat_message
  AFTER INSERT ON portal.messages
  FOR EACH ROW
  EXECUTE FUNCTION portal.notify_chat_message();
