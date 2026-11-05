ALTER TABLE portal.customers DROP CONSTRAINT IF EXISTS customers_systems_valid;

UPDATE portal.customers SET systems = systems - 'vector' WHERE systems ? 'vector';

ALTER TABLE portal.customers
  ALTER COLUMN systems SET DEFAULT '{"chat": "cometchat"}'::jsonb;

ALTER TABLE portal.customers
  ADD CONSTRAINT customers_systems_valid CHECK (
    (systems ? 'chat') AND (systems->>'chat') IN ('cometchat', 'supabase_realtime')
  );
