-- Query (SPA-487 to SPA-492): a client's own databases that admins connect
-- to the portal and query in plain text. Postgres only for now (`type`).
--
-- The password never sits in this table: it's a Supabase Vault secret, and
-- the row keeps only its id (`password_secret_id`). Only the edge functions
-- (service role) read the table or the passwords.
--
-- Each connection's structure (tables, columns, keys) is read when it's
-- saved and stored as JSON in the private `data_source_schemas` bucket, at
-- `{customer_id}/{data_source_id}.json` (`schema_path`).

CREATE TABLE IF NOT EXISTS portal.data_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The client it belongs to; removing the client removes its connections.
  customer_id uuid NOT NULL REFERENCES portal.customers(customer_id) ON DELETE CASCADE,
  -- What admins call it, e.g. "Production".
  name text NOT NULL,
  type text NOT NULL DEFAULT 'postgres' CHECK (type IN ('postgres')),
  host text NOT NULL,
  port integer NOT NULL DEFAULT 5432 CHECK (port BETWEEN 1 AND 65535),
  database_name text NOT NULL,
  username text NOT NULL,
  ssl boolean NOT NULL DEFAULT true,
  -- vault.secrets.id holding the password (see the functions below).
  password_secret_id uuid,
  -- The structure JSON in the data_source_schemas bucket, once read.
  schema_path text,
  schema_refreshed_at timestamptz,
  -- Why the last read of the structure failed; null once it succeeds.
  schema_error text,
  created_by uuid REFERENCES portal.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (customer_id, name)
);

CREATE INDEX IF NOT EXISTS data_sources_customer_id_idx ON portal.data_sources (customer_id);

-- Only edge functions (service role) read and write it.
ALTER TABLE portal.data_sources ENABLE ROW LEVEL SECURITY;
GRANT ALL ON portal.data_sources TO service_role;

CREATE OR REPLACE FUNCTION portal.touch_data_sources_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = '';

DROP TRIGGER IF EXISTS data_sources_updated_at ON portal.data_sources;
CREATE TRIGGER data_sources_updated_at
  BEFORE UPDATE ON portal.data_sources
  FOR EACH ROW EXECUTE FUNCTION portal.touch_data_sources_updated_at();

-- ── Passwords (Vault) ──────────────────────────────────────────────────────
-- Callable only by the service role: they read and write decrypted secrets.

-- Stores (or replaces) a connection's password.
CREATE OR REPLACE FUNCTION portal.set_data_source_password(p_data_source_id uuid, p_password text)
RETURNS void AS $$
DECLARE
  existing_secret_id uuid;
BEGIN
  SELECT password_secret_id INTO existing_secret_id
  FROM portal.data_sources WHERE id = p_data_source_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Data source % not found', p_data_source_id;
  END IF;

  IF existing_secret_id IS NULL THEN
    UPDATE portal.data_sources
    SET password_secret_id = vault.create_secret(
      p_password,
      'data_source_password_' || p_data_source_id,
      'Password for portal.data_sources ' || p_data_source_id
    )
    WHERE id = p_data_source_id;
  ELSE
    PERFORM vault.update_secret(existing_secret_id, p_password);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- The decrypted password, to open the connection.
CREATE OR REPLACE FUNCTION portal.get_data_source_password(p_data_source_id uuid)
RETURNS text AS $$
  SELECT s.decrypted_secret
  FROM portal.data_sources d
  JOIN vault.decrypted_secrets s ON s.id = d.password_secret_id
  WHERE d.id = p_data_source_id;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '';

-- Removes the connection's password from Vault. Called before deleting the
-- row (a deleted row would otherwise leave its secret behind).
CREATE OR REPLACE FUNCTION portal.delete_data_source_password(p_data_source_id uuid)
RETURNS void AS $$
  DELETE FROM vault.secrets
  WHERE id = (SELECT password_secret_id FROM portal.data_sources WHERE id = p_data_source_id);
$$ LANGUAGE sql SECURITY DEFINER SET search_path = '';

REVOKE ALL ON FUNCTION portal.set_data_source_password(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION portal.get_data_source_password(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION portal.delete_data_source_password(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION portal.set_data_source_password(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION portal.get_data_source_password(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION portal.delete_data_source_password(uuid) TO service_role;

-- ── Structure files ────────────────────────────────────────────────────────
-- Private, no policies: only the service role reads and writes it. 5 MB is
-- far more than the structure of even a large database needs.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('data_source_schemas', 'data_source_schemas', false, 5242880, ARRAY['application/json'])
ON CONFLICT (id) DO NOTHING;
