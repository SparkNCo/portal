-- SPA-513 fix: portal.chats/portal.messages RLS matched the caller via
-- `portal.users.auth_id = auth.uid()`, but auth_id is essentially unused
-- elsewhere in this app — supabase/functions/users/createUser.ts defaults it
-- to null, and nothing else in the codebase ever reads it. Every other
-- server-side identity check (see resolveCaller.ts, fetchUser in
-- users/index.ts) matches the Supabase Auth session to a portal.users row by
-- **email**, not auth_id.
--
-- With auth_id null for essentially every real user, `can_access_chat`'s
-- WHERE clause never matched anyone (not even admins, since the EXISTS finds
-- no `u` row at all), and `current_portal_user_id()` always returned NULL —
-- so `messages_insert`'s `user_id = portal.current_portal_user_id()` check
-- was never satisfiable. Chat creation (via the `chats` edge function,
-- service role, bypasses RLS) appeared to work fine; sending a message
-- (direct client insert, RLS-gated) silently failed, and so would every
-- direct SELECT on chats/messages.
--
-- `auth.email()` is Supabase's built-in helper (same JWT-claim source
-- resolveCaller.ts reads via supabase.auth.getUser()), so this switches both
-- functions to match on email instead, consistent with the rest of the app.

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
