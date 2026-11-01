-- Ticket-system API tokens (Jira, and later ADO), one per customer.
--
-- Which system a customer uses lives in `customers.systems.tickets`
-- ('linear' when missing), and the non-secret connection details (Jira URL,
-- account email) in `customers.systems.jira`. The token itself never sits in
-- a table: it's a Supabase Vault secret named `ticket_token:{customer_id}`,
-- readable only by the edge functions (service role) through the functions
-- below. Linear needs none of this — it uses the portal's own LINEAR_API_KEY.

-- Stores (or replaces) a customer's token.
CREATE OR REPLACE FUNCTION portal.set_ticket_token(p_customer_id uuid, p_token text)
RETURNS void AS $$
DECLARE
  secret_name text := 'ticket_token:' || p_customer_id;
  existing_secret_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM portal.customers WHERE customer_id = p_customer_id) THEN
    RAISE EXCEPTION 'Customer % not found', p_customer_id;
  END IF;

  SELECT id INTO existing_secret_id FROM vault.secrets WHERE name = secret_name;

  IF existing_secret_id IS NULL THEN
    PERFORM vault.create_secret(p_token, secret_name, 'Ticket system API token for portal.customers ' || p_customer_id);
  ELSE
    PERFORM vault.update_secret(existing_secret_id, p_token);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- The decrypted token, to call the customer's ticket system.
CREATE OR REPLACE FUNCTION portal.get_ticket_token(p_customer_id uuid)
RETURNS text AS $$
  SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'ticket_token:' || p_customer_id;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '';

-- Removes it (switching the customer back to Linear).
CREATE OR REPLACE FUNCTION portal.delete_ticket_token(p_customer_id uuid)
RETURNS void AS $$
  DELETE FROM vault.secrets WHERE name = 'ticket_token:' || p_customer_id;
$$ LANGUAGE sql SECURITY DEFINER SET search_path = '';

REVOKE ALL ON FUNCTION portal.set_ticket_token(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION portal.get_ticket_token(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION portal.delete_ticket_token(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION portal.set_ticket_token(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION portal.get_ticket_token(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION portal.delete_ticket_token(uuid) TO service_role;

-- A deleted customer takes its token with it.
CREATE OR REPLACE FUNCTION portal.delete_customer_ticket_token()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM vault.secrets WHERE name = 'ticket_token:' || OLD.customer_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

REVOKE ALL ON FUNCTION portal.delete_customer_ticket_token() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS customers_delete_ticket_token ON portal.customers;
CREATE TRIGGER customers_delete_ticket_token
  AFTER DELETE ON portal.customers
  FOR EACH ROW EXECUTE FUNCTION portal.delete_customer_ticket_token();
