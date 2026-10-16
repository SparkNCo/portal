-- A deleted connection takes its Vault password with it

CREATE OR REPLACE FUNCTION portal.delete_data_source_vault_secret()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.password_secret_id IS NOT NULL THEN
    DELETE FROM vault.secrets WHERE id = OLD.password_secret_id;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

REVOKE ALL ON FUNCTION portal.delete_data_source_vault_secret() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS data_sources_delete_vault_secret ON portal.data_sources;
CREATE TRIGGER data_sources_delete_vault_secret
  AFTER DELETE ON portal.data_sources
  FOR EACH ROW EXECUTE FUNCTION portal.delete_data_source_vault_secret();

DROP FUNCTION IF EXISTS portal.delete_data_source_password(uuid);
