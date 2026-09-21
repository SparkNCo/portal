-- SPA-513: per-project 3rd-party system selection, plus the Supabase Realtime
-- chat/messages tables that back the first system this enables (chat provider,
-- CometChat -> Supabase Realtime). The same `systems` column will later carry
-- the vector provider choice (Upstash -> pgvector) and any future swappable
-- integration.
--
-- Defaults to the systems already in production use (CometChat / Upstash) so
-- existing customers keep behaving exactly as they do today until someone
-- explicitly opts a project into the new provider. New customers should be
-- created with the new providers explicitly, not by relying on this default.

ALTER TABLE portal.customers
  ADD COLUMN IF NOT EXISTS systems jsonb NOT NULL
    DEFAULT '{"chat": "cometchat", "vector": "upstash"}'::jsonb;

ALTER TABLE portal.customers
  ADD CONSTRAINT customers_systems_valid CHECK (
    (systems ? 'chat') AND (systems->>'chat') IN ('cometchat', 'supabase_realtime') AND
    (systems ? 'vector') AND (systems->>'vector') IN ('upstash', 'pgvector')
  );

-- ---------------------------------------------------------------------------
-- Chats / messages (Supabase Realtime chat provider)
-- ---------------------------------------------------------------------------
-- Scoped by `project_slug`, same convention as portal.hours_logged /
-- portal.suggested_features / portal.tests — not a hard FK to a customers
-- row, since this app resolves customers by clientName/slug throughout
-- rather than by a customers.id join.
--
-- `type` covers the three CometChat surfaces this replaces: a 1:1 DM, a
-- free-standing group, and an issue-scoped group (see the old
-- portal.issue_chats / getOrCreateIssueGroup.ts). `metadata` carries
-- whatever is specific to that type (e.g. issue_id, participant ids) instead
-- of adding nullable columns for each surface.

CREATE TABLE IF NOT EXISTS portal.chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  project_slug text,

  title text,
  type text NOT NULL DEFAULT 'group' CHECK (type IN ('direct', 'group', 'issue')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_by uuid REFERENCES portal.users(id),

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_message_at timestamptz
);

CREATE TABLE IF NOT EXISTS portal.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  chat_id uuid NOT NULL REFERENCES portal.chats(id) ON DELETE CASCADE,
  -- Nullable so system/AI messages (see supabase/functions/lib/vector.ts's
  -- AI replies) aren't forced to point at a real portal.users row.
  user_id uuid REFERENCES portal.users(id),

  body text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at timestamptz NOT NULL DEFAULT now()
);

-- Explicit membership, same shape as CometChat's GroupMember list (see
-- useCometChat.ts's createSupportGroup, which resolves memberUids from the
-- customer + portal.assignments — never from a project_slug/linear_slug
-- match on portal.users). This is the source of truth RLS checks against
-- below, instead of trying to re-derive membership from user-level project
-- fields.
CREATE TABLE IF NOT EXISTS portal.chat_participants (
  chat_id uuid NOT NULL REFERENCES portal.chats(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES portal.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (chat_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_chats_project_slug ON portal.chats(project_slug);
CREATE INDEX IF NOT EXISTS idx_messages_chat_id_created_at ON portal.messages(chat_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_user_id ON portal.messages(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_participants_user_id ON portal.chat_participants(user_id);

-- updated_at trigger, same pattern as portal.tests / portal.suggested_features.
CREATE OR REPLACE FUNCTION portal.update_chats_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_chats_updated_at
  BEFORE UPDATE ON portal.chats
  FOR EACH ROW
  EXECUTE FUNCTION portal.update_chats_updated_at();

-- Keeps chats.last_message_at in sync so a chat list can sort/preview
-- without a correlated subquery over portal.messages.
CREATE OR REPLACE FUNCTION portal.touch_chat_last_message_at()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE portal.chats SET last_message_at = NEW.created_at WHERE id = NEW.chat_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER touch_chat_last_message_at
  AFTER INSERT ON portal.messages
  FOR EACH ROW
  EXECUTE FUNCTION portal.touch_chat_last_message_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
-- No other table in this project uses RLS today — access is otherwise
-- enforced app-side (Prisma over a direct/service connection, or edge
-- functions with the service role). Chats/messages/chat_participants are the
-- first tables a browser client is meant to read directly (via supabase-js
-- Realtime), so RLS is required here or an anon/authenticated key would be
-- able to read every customer's messages. Postgres Changes Realtime
-- evaluates these same policies against the connecting role, so enabling
-- RLS is also what scopes *subscriptions*, not just plain selects.
--
-- Membership is checked against portal.chat_participants (see above), not
-- against project_slug/linear_slug on portal.users — that field doesn't
-- exist on portal.users in the live schema (only on portal.customers), and
-- even if it did, CometChat's own membership resolution (useCometChat.ts)
-- is per-chat/explicit (customer + assignees), not "every user on this
-- project", so a join-table is the correct model here, not a stale-schema
-- workaround.
--
-- `admin` bypasses participation entirely, matching fetchGroups()'s
-- `if (!isAdmin) builder.joinedOnly(true)` today.

ALTER TABLE portal.chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal.chat_participants ENABLE ROW LEVEL SECURITY;

-- SECURITY DEFINER so the policies below don't also need SELECT grants on
-- portal.users/portal.chat_participants for anon/authenticated — only this
-- function's owner needs those, and it runs with the owner's privileges.
CREATE OR REPLACE FUNCTION portal.can_access_chat(target_chat_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM portal.users u
    WHERE u.auth_id = auth.uid()::text
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
  SELECT id FROM portal.users WHERE auth_id = auth.uid()::text;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = portal, pg_catalog;

CREATE POLICY chats_select ON portal.chats
  FOR SELECT USING (portal.can_access_chat(id));

-- Chat creation itself (and seeding chat_participants for it) is expected to
-- go through a server route using the service role — same pattern as
-- everywhere else in this app (assignments, users, etc. are all written via
-- edge functions/Prisma, never a direct client insert) — since resolving
-- who belongs in a chat means calling out to portal.assignments the same
-- way createSupportGroup() does today. No client-facing INSERT policy is
-- added for portal.chats/portal.chat_participants; the service role bypasses
-- RLS entirely, so this is intentionally left admin-only from the client's
-- perspective.

CREATE POLICY messages_select ON portal.messages
  FOR SELECT USING (portal.can_access_chat(chat_id));

CREATE POLICY messages_insert ON portal.messages
  FOR INSERT WITH CHECK (
    portal.can_access_chat(chat_id)
    -- Can't post as someone else.
    AND user_id = portal.current_portal_user_id()
  );

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
-- portal has never been exposed to anon/authenticated before (every other
-- table in it is only ever touched server-side, which connects as the
-- postgres/service role and so never needed these). Two things are
-- required for the policies above to actually take effect for a real
-- browser session, not just for the migration to apply:
--   1. USAGE on the schema — without it, "permission denied for schema
--      portal" regardless of any table grant or RLS policy.
--   2. Since Postgres 15, CREATE FUNCTION no longer grants EXECUTE to
--      PUBLIC by default, so the SECURITY DEFINER functions above need an
--      explicit grant or callers get "permission denied for function".
GRANT USAGE ON SCHEMA portal TO anon, authenticated;
GRANT SELECT ON portal.chats TO authenticated;
GRANT SELECT, INSERT ON portal.messages TO authenticated;
GRANT EXECUTE ON FUNCTION portal.can_access_chat(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION portal.current_portal_user_id() TO anon, authenticated;

-- Postgres Changes Realtime only streams changes for tables added to this
-- publication.
ALTER PUBLICATION supabase_realtime ADD TABLE portal.chats;
ALTER PUBLICATION supabase_realtime ADD TABLE portal.messages;
