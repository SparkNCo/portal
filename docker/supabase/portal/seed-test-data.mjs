// Test data for the LOCAL Supabase: one client (Spark-Portal, backed by its
// real Linear initiative) with the test users from seed-users.mjs linked to
// it, the way the portal links them:
//   - customer:    portal.users.customer_id → portal.customers.customer_id
//   - developer,   a portal.assignments row (customer_id = the customer
//     stakeholder: user's portal.users.id), its id added to both users'
//                  assignment_id
// Safe to run again: nothing is duplicated.
//
// Usage (from the repo root, after seed-users.mjs):
//   node docker/supabase/portal/seed-test-data.mjs
//
// The Linear tickets, projects and milestones aren't copied: the portal reads
// them live from Linear through linear_slug, with the cloud's LINEAR_API_KEY.
// Whatever is changed in Linear from the local portal changes for real.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Copied from the cloud's Spark-Portal row. linear_projects feeds "Cycle
// Scope vs Completed" (issueMetrics) and project_url the SDLC Metrics (dora).
const CLIENT = {
  clientName: "Spark-Portal",
  linear_slug: "f12c1e4fa44b",
  linear_projects: [
    "5939734b-bdb2-4c95-9ba6-8ca3809f5b2a",
    "6c7b2908-125d-4396-9050-c7c500576855",
    "7667694c-1ec2-436e-8604-fabd3d07efd9",
    "77354dd6-4d98-41f5-9aae-6a86df2adc78",
    "5fc9d05c-985a-4f5c-948c-c18445f1d4ce",
    "893237f9-4173-4f78-9810-b0bdcef375b3",
    "36c538b0-e1ca-4ad2-95a8-8d1f53b36d2c",
    "cc38bd89-8742-4db8-a30f-745a648ce09d",
  ],
  project_url: ["https://github.com/SparkNCo/portal"],
};

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..", "..");

// Like Docker Compose: spaces around "=" and surrounding quotes aren't part
// of the value.
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

const headers = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
  "Accept-Profile": "portal",
  "Content-Profile": "portal",
};

async function rest(path, options = {}) {
  const res = await fetch(`${API_URL}/rest/v1/${path}`, { ...options, headers: { ...headers, ...options.headers } });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${options.method ?? "GET"} ${path} → ${res.status}: ${text}`);
  }
  return text ? JSON.parse(text) : null;
}

const one = async (path) => (await rest(path))[0] ?? null;

async function userByEmail(email) {
  const user = await one(`users?select=id,role,assignment_id&email=ilike.${encodeURIComponent(email)}`);
  if (!user) {
    console.error(`No portal.users row for ${email}: run node docker/supabase/portal/seed-users.mjs first`);
    process.exit(1);
  }
  return user;
}

// 1. The client.
let client = await one(`customers?select=customer_id&clientName=ilike.${encodeURIComponent(CLIENT.clientName)}`);
const customerEmail = tests.get("TEST_CUSTOMER_EMAIL");
if (client) {
  await rest(`customers?customer_id=eq.${client.customer_id}`, {
    method: "PATCH",
    body: JSON.stringify({
      linear_slug: CLIENT.linear_slug,
      linear_projects: CLIENT.linear_projects,
      project_url: CLIENT.project_url,
    }),
  });
  console.log(`client       ${CLIENT.clientName} already there`);
} else {
  [client] = await rest("customers?select=customer_id", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      clientName: CLIENT.clientName,
      linear_name: CLIENT.clientName,
      linear_slug: CLIENT.linear_slug,
      linear_projects: CLIENT.linear_projects,
      project_url: CLIENT.project_url,
      email: customerEmail,
      // Invoiced by hand: no Stripe subscription is created for test data.
      billing_mode: "manual",
    }),
  });
  console.log(`client       ${CLIENT.clientName} created`);
}

// 2. The customer user belongs to it.
const customer = await userByEmail(customerEmail);
await rest(`users?id=eq.${customer.id}`, {
  method: "PATCH",
  body: JSON.stringify({ customer_id: client.customer_id }),
});
console.log(`customer     ${customerEmail} → ${CLIENT.clientName}`);

// 3. Developer and stakeholder: an assignment to that customer user.
async function assign(email, role) {
  const user = await userByEmail(email);
  let assignment = await one(`assignments?select=id&user_id=eq.${user.id}&customer_id=eq.${customer.id}`);
  if (!assignment) {
    [assignment] = await rest("assignments?select=id", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        user_id: user.id,
        customer_id: customer.id,
        role,
        // Same defaults as assignments/createAssignment.ts.
        ...(role === "developer" && { allocation: 40 }),
      }),
    });
  }
  // Both sides keep the assignment id, like createAssignment does.
  for (const id of [user.id, customer.id]) {
    const row = await one(`users?select=assignment_id&id=eq.${id}`);
    const current = row?.assignment_id ?? [];
    if (!current.includes(assignment.id)) {
      await rest(`users?id=eq.${id}`, {
        method: "PATCH",
        body: JSON.stringify({ assignment_id: [...current, assignment.id] }),
      });
    }
  }
  console.log(`${role.padEnd(12)} ${email} → ${CLIENT.clientName}`);
}

await assign(tests.get("TEST_DEVELOPER_EMAIL"), "developer");
await assign(tests.get("TEST_HOLDER_EMAIL"), "stakeholder");
