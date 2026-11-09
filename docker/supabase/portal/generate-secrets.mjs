// Prints a fresh set of the self-hosted stack's secrets, ready to paste into
// docker/supabase/.env. Nothing is written to disk.
//
// Usage (from the repo root):
//   node docker/supabase/portal/generate-secrets.mjs
//
// Every run gives new values. Changing JWT_SECRET (and so ANON_KEY /
// SERVICE_ROLE_KEY) on a running stack signs everyone out and invalidates
// the anon key the portal uses (.env.local / the portal image), so update
// those too. Changing POSTGRES_PASSWORD on an existing database doesn't
// change the password of its roles: see docs/LOCAL_SUPABASE.md.

import { createHmac, randomBytes } from "node:crypto";

const hex = (bytes) => randomBytes(bytes).toString("hex");
const b64url = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");

// The legacy API keys: HS256 JWTs signed with JWT_SECRET, valid for 5 years.
function apiKey(role, secret) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url({ alg: "HS256", typ: "JWT" });
  const payload = b64url({ role, iss: "supabase", iat: now, exp: now + 5 * 365 * 24 * 3600 });
  const signature = createHmac("sha256", secret).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${signature}`;
}

const jwtSecret = hex(32);

const secrets = {
  POSTGRES_PASSWORD: hex(16),
  JWT_SECRET: jwtSecret,
  ANON_KEY: apiKey("anon", jwtSecret),
  SERVICE_ROLE_KEY: apiKey("service_role", jwtSecret),
  DASHBOARD_PASSWORD: hex(16),
  SECRET_KEY_BASE: hex(32),
  // Exactly 32 characters.
  VAULT_ENC_KEY: hex(16),
  PG_META_CRYPTO_KEY: hex(16),
  S3_PROTOCOL_ACCESS_KEY_ID: hex(16),
  S3_PROTOCOL_ACCESS_KEY_SECRET: hex(32),
};

for (const [name, value] of Object.entries(secrets)) {
  console.log(`${name}=${value}`);
}
