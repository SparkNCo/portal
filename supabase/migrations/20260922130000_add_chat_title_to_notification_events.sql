-- The bell's chat notifications just said "sent a message in a chat" —
-- issue-linked events get a readable label via `issue_code` (see
-- formatObject in NotificationBell.tsx), but chat events had nothing
-- equivalent to name *which* chat. Store the chat's own title at the time
-- of the message (chats.title can change later; this is a point-in-time
-- label like issue_code already is) so the frontend can show "sent a
-- message in <chat title>" instead of the generic fallback.

ALTER TABLE portal.events ADD COLUMN IF NOT EXISTS object_title text;

CREATE OR REPLACE FUNCTION portal.notify_chat_message()
RETURNS TRIGGER AS $$
DECLARE
  new_event_id uuid;
  recipient RECORD;
  existing_notification_id uuid;
  chat_title text;
BEGIN
  SELECT title INTO chat_title FROM portal.chats WHERE id = NEW.chat_id;

  INSERT INTO portal.events (actor_user_id, actor_email, action, object_type, object_id, object_title, preview, link)
  VALUES (
    NEW.user_id,
    (SELECT email FROM portal.users WHERE id = NEW.user_id),
    'chat_message',
    'chat',
    NEW.chat_id::text,
    chat_title,
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
