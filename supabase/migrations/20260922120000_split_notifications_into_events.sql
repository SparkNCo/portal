-- Splits portal.notifications into an immutable `events` log plus
-- `notifications` as a per-(user, event) row with `read`.
--
-- Dedupe (one unread notification per chat/issue) can't be a unique index
-- anymore (it depends on the linked event), so callers do it: insert an event,
-- then insert a notification or re-point the existing unread one.

CREATE TABLE IF NOT EXISTS portal.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Who/what triggered it. actor_user_id is nullable (system/AI-authored
  -- events have no portal.users row); actor_email is kept alongside it so
  -- the bell can still show *something* human-readable even then.
  actor_user_id uuid REFERENCES portal.users(id),
  actor_email text,

  -- e.g. 'chat_message', 'decision_requested', 'decision_answered',
  -- 'demo_uploaded', 'design_resource_added', 'requirement_update_added'.
  action text NOT NULL,
  -- e.g. 'chat', 'issue_decision', 'demo', 'design_resource'.
  object_type text NOT NULL,
  -- The underlying row's id (chat_id, decision id, demo_videos id,
  -- design_resources id) — opaque here, interpreted by the frontend
  -- alongside `link`.
  object_id text NOT NULL,
  issue_code text,
  issue_id text,
  preview text,
  link text NOT NULL,

  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_events_thread_issue ON portal.events(object_type, issue_id);
CREATE INDEX IF NOT EXISTS idx_events_thread_object ON portal.events(object_type, object_id);

-- ---------------------------------------------------------------------------
-- Reshape portal.notifications
-- ---------------------------------------------------------------------------
ALTER TABLE portal.notifications ADD COLUMN IF NOT EXISTS event_id uuid;
ALTER TABLE portal.notifications ADD COLUMN IF NOT EXISTS read boolean NOT NULL DEFAULT false;

-- Backfill: one event per existing notification, reusing its id as the event id.
INSERT INTO portal.events (id, actor_user_id, actor_email, action, object_type, object_id, issue_code, issue_id, preview, link, created_at)
SELECT id, actor_user_id, actor_email, action, object_type, object_id, issue_code, issue_id, preview, link, created_at
FROM portal.notifications
ON CONFLICT (id) DO NOTHING;

UPDATE portal.notifications SET event_id = id WHERE event_id IS NULL;
UPDATE portal.notifications SET read = (read_at IS NOT NULL);

ALTER TABLE portal.notifications ALTER COLUMN event_id SET NOT NULL;
ALTER TABLE portal.notifications
  ADD CONSTRAINT notifications_event_id_fkey FOREIGN KEY (event_id) REFERENCES portal.events(id) ON DELETE CASCADE;

DROP INDEX IF EXISTS portal.idx_notifications_unread_chat_dedupe;
DROP INDEX IF EXISTS portal.idx_notifications_unread_issue_dedupe;
DROP INDEX IF EXISTS portal.idx_notifications_user_unread;
DROP INDEX IF EXISTS portal.idx_notifications_user_created;

ALTER TABLE portal.notifications
  DROP COLUMN actor_user_id,
  DROP COLUMN actor_email,
  DROP COLUMN action,
  DROP COLUMN object_type,
  DROP COLUMN object_id,
  DROP COLUMN issue_code,
  DROP COLUMN issue_id,
  DROP COLUMN preview,
  DROP COLUMN link,
  DROP COLUMN read_at;

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON portal.notifications(user_id, created_at DESC)
  WHERE read = false;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
-- events are readable only through a notification that points at them.
ALTER TABLE portal.events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS events_select_via_notification ON portal.events;
CREATE POLICY events_select_via_notification ON portal.events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM portal.notifications n
      WHERE n.event_id = events.id AND n.user_id = portal.current_portal_user_id()
    )
  );

GRANT SELECT ON portal.events TO authenticated;

-- ---------------------------------------------------------------------------
-- Chat message -> event + notification fan-out (rewritten for the new shape)
-- ---------------------------------------------------------------------------
-- Supersedes both earlier versions (includes 20260922110000's admin fan-out).
CREATE OR REPLACE FUNCTION portal.notify_chat_message()
RETURNS TRIGGER AS $$
DECLARE
  new_event_id uuid;
  recipient RECORD;
  existing_notification_id uuid;
BEGIN
  INSERT INTO portal.events (actor_user_id, actor_email, action, object_type, object_id, preview, link)
  VALUES (
    NEW.user_id,
    (SELECT email FROM portal.users WHERE id = NEW.user_id),
    'chat_message',
    'chat',
    NEW.chat_id::text,
    left(NEW.body, 140),
    -- Fallback only; NotificationBell resolves the real chat path on click.
    '/chat'
  )
  RETURNING id INTO new_event_id;

  FOR recipient IN
    SELECT r.user_id FROM (
      SELECT cp.user_id FROM portal.chat_participants cp WHERE cp.chat_id = NEW.chat_id
      UNION
      SELECT u.id FROM portal.users u WHERE u.role = 'admin'
    ) AS r(user_id)
    WHERE r.user_id IS DISTINCT FROM NEW.user_id
  LOOP
    -- One unread notification per (user, chat): re-point instead of adding rows.
    SELECT n.id INTO existing_notification_id
    FROM portal.notifications n
    JOIN portal.events e ON e.id = n.event_id
    WHERE n.user_id = recipient.user_id
      AND n.read = false
      AND e.object_type = 'chat'
      AND e.object_id = NEW.chat_id::text
    LIMIT 1;

    IF existing_notification_id IS NOT NULL THEN
      UPDATE portal.notifications SET event_id = new_event_id, created_at = now() WHERE id = existing_notification_id;
    ELSE
      INSERT INTO portal.notifications (user_id, event_id, read) VALUES (recipient.user_id, new_event_id, false);
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = portal, pg_catalog;
