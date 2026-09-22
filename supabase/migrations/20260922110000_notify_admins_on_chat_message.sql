-- Admins weren't getting chat notifications: they see every chat via the
-- `role = 'admin'` bypass in portal.can_access_chat, but that bypass only
-- covers *access* — this trigger only ever fanned notifications out to
-- portal.chat_participants, which admins are deliberately never seeded
-- into (see 20260921120000_add_systems_config_and_chat_tables.sql's
-- resolveParticipants.ts comment). Union in every admin explicitly instead.
CREATE OR REPLACE FUNCTION portal.notify_chat_message()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO portal.notifications (user_id, actor_user_id, actor_email, action, object_type, object_id, preview, link)
  SELECT
    recipient.user_id,
    NEW.user_id,
    (SELECT email FROM portal.users WHERE id = NEW.user_id),
    'chat_message',
    'chat',
    NEW.chat_id::text,
    left(NEW.body, 140),
    '/chat'
  FROM (
    SELECT cp.user_id FROM portal.chat_participants cp WHERE cp.chat_id = NEW.chat_id
    UNION
    SELECT u.id FROM portal.users u WHERE u.role = 'admin'
  ) AS recipient(user_id)
  WHERE recipient.user_id IS DISTINCT FROM NEW.user_id
  ON CONFLICT (user_id, object_id) WHERE read_at IS NULL AND object_type = 'chat'
  DO UPDATE SET
    actor_user_id = EXCLUDED.actor_user_id,
    actor_email = EXCLUDED.actor_email,
    preview = EXCLUDED.preview,
    created_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = portal, pg_catalog;
