-- Chat RLS matched users by auth_id, which is null for almost every user, so
-- every client read/insert on chats/messages failed. Match by auth.email()
-- instead, like the rest of the app's identity checks.

CREATE OR REPLACE FUNCTION portal.can_access_chat(target_chat_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM portal.users u
    WHERE u.email = auth.email()
      AND (
        u.role = 'admin'
        OR EXISTS (
          SELECT 1 FROM portal.chat_participants cp
          WHERE cp.chat_id = target_chat_id AND cp.user_id = u.id
        )
      )
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = portal, pg_catalog;

CREATE OR REPLACE FUNCTION portal.current_portal_user_id()
RETURNS uuid AS $$
  SELECT id FROM portal.users WHERE email = auth.email();
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = portal, pg_catalog;
