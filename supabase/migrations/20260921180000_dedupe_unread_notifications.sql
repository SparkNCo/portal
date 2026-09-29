-- One unread notification per chat (or per issue+type), refreshed in place
-- until read. Partial indexes (WHERE read_at IS NULL), so a read row doesn't
-- block the next one.

-- Chat: one unread row per (user_id, chat_id). object_id already *is* the
-- chat_id for chat notifications (see notify_chat_message below).
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_unread_chat_dedupe
  ON portal.notifications (user_id, object_id)
  WHERE read_at IS NULL AND object_type = 'chat';

-- Decisions/demos/design: keyed by issue_id (object_id differs on every event).
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_unread_issue_dedupe
  ON portal.notifications (user_id, object_type, issue_id)
  WHERE read_at IS NULL AND issue_id IS NOT NULL;

-- ON CONFLICT against the partial index. (notify.ts can't do this through
-- PostgREST, so it does select-then-update/insert instead.)
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
