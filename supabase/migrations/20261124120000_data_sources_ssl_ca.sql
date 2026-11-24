-- Query: the CA certificate a connection's server is signed with, for
-- providers that sign with their own CA instead of a public one (Aiven, AWS
-- RDS, a self-signed server). With it the portal verifies the server over
-- SSL; without it (null) connections work as before.
--
-- A CA certificate isn't secret (providers let anyone download it), so it's
-- a plain column, unlike the password (Vault).

ALTER TABLE portal.data_sources ADD COLUMN IF NOT EXISTS ssl_ca text;

ALTER TABLE portal.data_sources
  ADD CONSTRAINT data_sources_ssl_ca_check CHECK (ssl_ca IS NULL OR length(ssl_ca) <= 20000);
