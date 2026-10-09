-- Files attached to Realtime chat messages (listed in
-- portal.messages.metadata.attachments). Private bucket: the browser reads
-- them through signed URLs. Objects are stored as `{chat_id}/{random}-{name}`,
-- and only people who can access that chat (portal.can_access_chat — its
-- participants, plus admins) can upload or read them. 25 MB per file, same
-- cap the chat composer checks before uploading.

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('chat-attachments', 'chat-attachments', false, 26214400)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY chat_attachments_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'chat-attachments'
    AND portal.can_access_chat(((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY chat_attachments_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'chat-attachments'
    AND portal.can_access_chat(((storage.foldername(name))[1])::uuid)
  );

-- Chat notifications preview the message text; a message with only files
-- now says "Sent an attachment" / "Sent N attachments" instead of nothing.
-- Same function as 20260922130000_add_chat_title_to_notification_events.sql
-- apart from the preview.

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
    -- A message with only files has no text; say what it carried instead.
    COALESCE(
      NULLIF(left(NEW.body, 140), ''),
      CASE jsonb_array_length(COALESCE(NEW.metadata->'attachments', '[]'::jsonb))
        WHEN 0 THEN ''
        WHEN 1 THEN 'Sent an attachment'
        ELSE 'Sent ' || jsonb_array_length(NEW.metadata->'attachments') || ' attachments'
      END
    ),
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
