-- Per-customer 3rd-party provider selection (`systems`: chat, vector, ...), plus
-- the Supabase Realtime chat tables.
--
-- Defaults to the current providers (CometChat / Upstash) so existing customers
-- are unaffected; new customers should set the new providers explicitly.

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
-- Scoped by `project_slug` (no FK, same as other per-customer tables).
-- `type`: 1:1 DM, group, or issue-scoped group; type-specific data goes in `metadata`.

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
  -- Nullable for system/AI messages.
  user_id uuid REFERENCES portal.users(id),

  body text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at timestamptz NOT NULL DEFAULT now()
);

-- Explicit membership (customer + assignees, like CometChat's groups). RLS
-- below checks against this table.
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

-- updated_at trigger.
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
-- The browser reads these tables directly (Realtime), so RLS is required —
-- otherwise any anon/authenticated key could read every customer's messages.
-- Realtime applies the same policies, so this also scopes subscriptions.
-- Membership comes from chat_participants; admins bypass it.

ALTER TABLE portal.chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal.chat_participants ENABLE ROW LEVEL SECURITY;

-- SECURITY DEFINER so anon/authenticated don't need SELECT on users/chat_participants.
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

-- No client INSERT policy on chats/chat_participants: they're created
-- server-side (service role), since membership is resolved from assignments.

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
-- First time portal is exposed to anon/authenticated. Browser sessions need:
--   1. USAGE on the schema ("permission denied for schema portal" otherwise).
--   2. EXECUTE on the functions above (Postgres 15+ no longer grants it to PUBLIC).
GRANT USAGE ON SCHEMA portal TO anon, authenticated;
GRANT SELECT ON portal.chats TO authenticated;
GRANT SELECT, INSERT ON portal.messages TO authenticated;
GRANT EXECUTE ON FUNCTION portal.can_access_chat(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION portal.current_portal_user_id() TO anon, authenticated;

-- Postgres Changes Realtime only streams changes for tables added to this
-- publication.
ALTER PUBLICATION supabase_realtime ADD TABLE portal.chats;
ALTER PUBLICATION supabase_realtime ADD TABLE portal.messages;
