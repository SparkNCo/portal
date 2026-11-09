// Creates one test user per role in the LOCAL Supabase: the Auth account and
// its portal.users row, with the emails and passwords in .env.test (the same
// ones the e2e tests sign in with). Safe to run again: existing users are
// left as they are (their password is reset to the one in .env.test).
//
// Usage (from the repo root, with the stack up):
//   node docker/supabase/portal/seed-users.mjs
//
// Customer and stakeholder users get no customer_id here: the test data
// (step 9) links them to a test client.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..", "..");

// Like Docker Compose: spaces around "=" and surrounding quotes aren't part
// of the value; a line starting with # is a comment.
function readEnv(path) {
  const values = new Map();
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = /^([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (match) {
      values.set(match[1], match[2].replace(/^(["'])(.*)\1$/, "$2"));
    }
  }
  return values;
}

const stack = readEnv(join(here, "..", ".env"));
const tests = readEnv(join(repoRoot, ".env.test"));

// Only ever the local stack: these calls use its service key.
const API_URL = "http://localhost:8000";
const SERVICE_KEY = stack.get("SERVICE_ROLE_KEY");
if (!SERVICE_KEY) {
  console.error("SERVICE_ROLE_KEY is missing from docker/supabase/.env");
  process.exit(1);
}

const USERS = [
  { role: "admin", email: tests.get("TEST_ADMIN_EMAIL"), password: tests.get("TEST_PASSWORD"), firstName: "Test", lastName: "Admin" },
  { role: "developer", email: tests.get("TEST_DEVELOPER_EMAIL"), password: tests.get("TEST_PASSWORD"), firstName: "Test", lastName: "Developer" },
  { role: "customer", email: tests.get("TEST_CUSTOMER_EMAIL"), password: tests.get("TEST_PASSWORD"), firstName: "Test", lastName: "Customer" },
  { role: "stakeholder", email: tests.get("TEST_HOLDER_EMAIL"), password: tests.get("TEST_HOLDER_PASSWORD") ?? tests.get("TEST_PASSWORD"), firstName: "Test", lastName: "Stakeholder" },
];

const missing = USERS.filter((u) => !u.email || !u.password).map((u) => u.role);
if (missing.length) {
  console.error(`.env.test is missing the email or password for: ${missing.join(", ")}`);
  process.exit(1);
}

const headers = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
};

async function call(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, { ...options, headers: { ...headers, ...options.headers } });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new Error(`${options.method ?? "GET"} ${path} → ${res.status}: ${text}`);
  }
  return body;
}

// GoTrue's admin list is paged; a local test stack has few users.
async function findAuthUser(email) {
  const { users } = await call("/auth/v1/admin/users?per_page=1000");
  return users.find((u) => u.email?.toLowerCase() === email.toLowerCase()) ?? null;
}

async function ensureAuthUser({ email, password }) {
  const existing = await findAuthUser(email);
  if (existing) {
    await call(`/auth/v1/admin/users/${existing.id}`, {
      method: "PUT",
      body: JSON.stringify({ password, email_confirm: true }),
    });
    return { id: existing.id, created: false };
  }
  const created = await call("/auth/v1/admin/users", {
    method: "POST",
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  return { id: created.id, created: true };
}

const portal = { "Accept-Profile": "portal", "Content-Profile": "portal" };

async function ensurePortalRow({ role, email, firstName, lastName }, authId) {
  const rows = await call(`/rest/v1/users?select=id,role&email=ilike.${encodeURIComponent(email)}`, { headers: portal });
  if (rows.length) {
    await call(`/rest/v1/users?id=eq.${rows[0].id}`, {
      method: "PATCH",
      headers: portal,
      body: JSON.stringify({ role, auth_id: authId }),
    });
    return false;
  }
  await call("/rest/v1/users", {
    method: "POST",
    headers: { ...portal, Prefer: "return=minimal" },
    body: JSON.stringify({ email, role, auth_id: authId, firstName, lastName, userName: `${firstName} ${lastName}` }),
  });
  return true;
}

for (const user of USERS) {
  const auth = await ensureAuthUser(user);
  const rowCreated = await ensurePortalRow(user, auth.id);
  const what = auth.created || rowCreated ? "created" : "already there (password reset)";
  console.log(`${user.role.padEnd(12)} ${user.email.padEnd(40)} ${what}`);
}
