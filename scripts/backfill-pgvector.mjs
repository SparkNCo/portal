// One-off: generates pgvector embeddings for everything that was only indexed
// in Upstash (issues, test cases, documents). Safe to re-run — each endpoint
// only picks up rows that are still missing an embedding.
//
// Usage:
//   SUPABASE_URL=https://<project>.supabase.co \
//   SERVICE_ROLE_KEY=<service role key> \
//   ADMIN_USER_ID=<portal.users.id of an admin> \
//   node scripts/backfill-pgvector.mjs [clientName]
//
// Without a clientName it runs for every customer.

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

async function call(path, init = {}) {
  const res = await fetch(`${SUPABASE_URL}${path}`, { ...init, headers: { ...headers, ...init.headers } });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(`${path} → ${res.status}: ${JSON.stringify(body)}`);
  }
  return body;
}

// Calls `step` until nothing is left, or a batch makes no progress (rows that
// keep failing — logged by the function, not retried forever here).
async function drain(label, step) {
  let total = 0;
  for (;;) {
    const { progress, remaining } = await step();
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
