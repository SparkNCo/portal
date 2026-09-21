-- SPA-513 follow-up: multiple chat messages in the same chat, or multiple
-- decisions/demos/design updates on the same issue, used to create a
-- separate unread notification per event — noisy on an active thread.
-- Collapses to one unread row per "thing" (per chat, or per issue+type),
-- refreshed in place (actor/preview/created_at) as more events happen,
-- until it's actually read. Once read, the next event starts a fresh row —
-- these are partial indexes (WHERE read_at IS NULL), not a permanent
-- one-row-per-thread constraint.

-- Chat: one unread row per (user_id, chat_id). object_id already *is* the
-- chat_id for chat notifications (see notify_chat_message below).
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_unread_chat_dedupe
  ON portal.notifications (user_id, object_id)
  WHERE read_at IS NULL AND object_type = 'chat';

-- Decisions/demos/design: one unread row per (user_id, object_type,
-- issue_id) — object_id itself isn't the dedupe key here, since it's the
-- specific decision/demo/design row's own id, which differs on every event
-- even for the same issue.
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_unread_issue_dedupe
  ON portal.notifications (user_id, object_type, issue_id)
  WHERE read_at IS NULL AND issue_id IS NOT NULL;

-- Refreshes the existing unread row for this (user, chat) in place instead
-- of inserting a new one, per idx_notifications_unread_chat_dedupe above.
-- notifyProject (supabase/functions/utils/notify.ts) does the equivalent
-- select-then-update/insert in application code instead of ON CONFLICT,
-- since PostgREST's upsert can't target a partial unique index — this
-- trigger runs as raw SQL, so it isn't limited by that.
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
    '/chat'
  FROM portal.chat_participants cp
  WHERE cp.chat_id = NEW.chat_id
    AND cp.user_id IS DISTINCT FROM NEW.user_id
  ON CONFLICT (user_id, object_id) WHERE read_at IS NULL AND object_type = 'chat'
  DO UPDATE SET
    actor_user_id = EXCLUDED.actor_user_id,
    actor_email = EXCLUDED.actor_email,
    preview = EXCLUDED.preview,
    created_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = portal, pg_catalog;
