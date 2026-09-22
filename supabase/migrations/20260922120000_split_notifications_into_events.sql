-- Splits the combined portal.notifications (event data + per-recipient read
-- state in one row) into the shape a specific ticket calls for: an
-- immutable `events` log (one row per thing that happened) plus
-- `notifications` as a thin per-(user, event) join with a boolean `read`.
-- A single event can now be shared by every recipient's notification
-- instead of the same action/object/preview/link being duplicated once per
-- recipient.
--
-- Dedupe (one unread notification per active chat/issue, not one per
-- message/question) survives this differently than before: it used to be a
-- partial UNIQUE index + ON CONFLICT directly on portal.notifications, but
-- "same thread" now means "same object_type/issue_id on the *linked*
-- event", which a plain index on portal.notifications can't see across the
-- join. Callers (notify_chat_message below, notify.ts's notifyProject) now
-- do it explicitly: always insert a new event, then either insert a new
-- notification or re-point an existing unread one at that new event —
-- same visible behavior (one unread row per thread), but the full event
-- history is preserved instead of being overwritten in place.

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

-- Backfill: one event per existing notification, reusing that
-- notification's own id as the new event's id — a simple, collision-free
-- way to correlate the INSERT back to the row it came from without a
-- temporary bridge column. Existing rows never shared an event to begin
-- with (that's exactly what this migration fixes going forward), so this
-- loses nothing.
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
-- events has no direct owner check of its own — it's only ever readable
-- through a notification that points at it (so the bell's embedded-select
-- join, `notifications.select("*, event:events(*)")`, works under RLS).
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
-- Also folds in 20260922110000's admin fan-out (UNION with every admin,
-- not just chat_participants) — this CREATE OR REPLACE fully supersedes
-- both of the two prior versions of this function.
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
    -- A generic fallback, not a deep link to this specific conversation —
    -- the frontend NotificationBell resolves the real, role-prefixed inbox
    -- path for `object_type = 'chat'` at click time.
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
    -- One unread notification per (user, chat) — a chat's Nth message while
    -- the (N-1)th is still unread re-points the existing notification at
    -- this newest event instead of piling up another row.
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
