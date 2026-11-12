// Fills portal.embeddings (one vector per chunk) for issues, test cases and
// documents that aren't fully embedded yet: everything that existed before
// chunked embeddings (20261110120000_embeddings_table.sql), and long documents
// or tests that one call couldn't finish. Safe to re-run — each endpoint only
// picks up what's still missing.
//
// Usage (bash):
//   SUPABASE_URL=https://<project>.supabase.co \
//   SERVICE_ROLE_KEY=<service role key> \
//   ADMIN_USER_ID=<portal.users.id of an admin> \
//   node scripts/backfill-pgvector.mjs [clientName]
//
// Usage (PowerShell):
//   $env:SUPABASE_URL = "https://<project>.supabase.co"
//   $env:SERVICE_ROLE_KEY = "<service role key>"
//   $env:ADMIN_USER_ID = "<portal.users.id of an admin>"
//   node scripts/backfill-pgvector.mjs [clientName]
//
// SERVICE_ROLE_KEY: the legacy service_role key (a JWT, "eyJ…", under Project
// Settings → API Keys → Legacy API Keys). The functions verify JWTs, so the
// newer "sb_secret_…" keys can be rejected. ADMIN_USER_ID: portal.users.id
// (not auth.users) of a user with role "admin".
//
// Without a clientName it runs for every customer.
//
// Each call embeds ~800 words (the functions' ~2 s CPU limit), so this loops.
// A call that runs out of CPU anyway (WORKER_RESOURCE_LIMIT, most often on a
// cold start while the model loads) or hits a network / 5xx error is retried.

const { SUPABASE_URL, SERVICE_ROLE_KEY, ADMIN_USER_ID } = process.env;
const onlyClient = process.argv[2];

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !ADMIN_USER_ID) {
  console.error("Set SUPABASE_URL, SERVICE_ROLE_KEY and ADMIN_USER_ID.");
  process.exit(1);
}

const headers = {
  "Content-Type": "application/json",
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
};

class CallError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function call(path, init = {}) {
  const res = await fetch(`${SUPABASE_URL}${path}`, { ...init, headers: { ...headers, ...init.headers } });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new CallError(`${path} → ${res.status}: ${JSON.stringify(body)}`, res.status);
  }
  return body;
}

const MAX_ATTEMPTS = 5;
const RETRY_WAIT_MS = 3000;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Out of CPU (WORKER_RESOURCE_LIMIT comes back as a 5xx), a 5xx or a network
// error: worth another try. A 4xx (bad key, not an admin, unknown client)
// won't fix itself, so it stops the script.
const isRetryable = (err) => !(err instanceof CallError) || err.status >= 500;

async function withRetries(label, step) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await step();
    } catch (err) {
      if (!isRetryable(err) || attempt >= MAX_ATTEMPTS) throw err;
      console.warn(`  ${label}: failed (${attempt}/${MAX_ATTEMPTS}), retrying — ${err.message}`);
      await sleep(RETRY_WAIT_MS);
    }
  }
}

// Calls `step` until nothing is left, or a batch makes no progress (rows that
// keep failing — logged by the function, not retried forever here).
async function drain(label, step) {
  let total = 0;
  for (;;) {
    const { progress, remaining } = await withRetries(label, step);
    total += progress;
    console.log(`  ${label}: +${progress} (${remaining} left)`);
    if (remaining === 0) {
      break;
    }
    if (progress === 0) {
      console.warn(`  ${label}: no progress, stopping — check the function logs for the failing rows`);
      break;
    }
  }
  return total;
}

async function main() {
  const customers = await call(
    "/rest/v1/customers?select=clientName,linear_slug&linear_slug=not.is.null",
    { headers: { "Accept-Profile": "portal" } },
  );
  const targets = onlyClient
    ? customers.filter((c) => c.clientName?.toLowerCase() === onlyClient.toLowerCase())
    : customers;
  if (targets.length === 0) {
    console.error(onlyClient ? `No customer named "${onlyClient}".` : "No customers found.");
    process.exit(1);
  }

  for (const { clientName } of targets) {
    console.log(`\n${clientName}`);

    await drain("issues", async () => {
      const r = await call(
        `/functions/v1/linear-vector-sync?slug=${encodeURIComponent(clientName)}&full=true`,
        { method: "POST" },
      );
      const result = r.results?.[0] ?? { synced: 0, remaining: 0 };
      return { progress: result.synced, remaining: result.remaining };
    });

    await drain("tests", async () => {
      const r = await call("/functions/v1/tests/backfill-vectors", {
        method: "POST",
        body: JSON.stringify({ user_id: ADMIN_USER_ID, project_slug: clientName }),
      });
      return { progress: r.vectorized, remaining: r.remaining };
    });
  }

  // Documents are scoped by project_slug (= linear_slug), so they're done in
  // one pass across every customer — or just the chosen one.
  console.log("\ndocuments");
  const docSlug = onlyClient ? targets[0].linear_slug : undefined;
  await drain("documents", async () => {
    const r = await call("/functions/v1/storage/backfill-vectors", {
      method: "POST",
      body: JSON.stringify({ user_id: ADMIN_USER_ID, ...(docSlug ? { project_slug: docSlug } : {}) }),
    });
    return { progress: r.vectorized, remaining: r.remaining };
  });

  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
