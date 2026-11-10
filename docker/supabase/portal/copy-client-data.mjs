// Copies one client's documents (rows + files) and test cases from the CLOUD
// project into the LOCAL stack, so search and embeddings can be tried on
// real content. Issues aren't copied: run linear-vector-sync locally, it
// reads them from Linear.
//
// Reads the cloud only (never writes there); writes the local stack only.
// Safe to run again: documents already copied (same file path) and tests
// (same id) are updated, not duplicated.
//
// Usage (from the repo root, local stack up):
//   node docker/supabase/portal/copy-client-data.mjs            ← Spark-Portal
//   node docker/supabase/portal/copy-client-data.mjs <linear_slug> <clientName>
//
// Copied rows start with embeddings_complete = false, so the local backfills
// (storage/backfill-vectors, tests/backfill-vectors) embed them.
//
// Only for clients whose content may live on a developer machine: Spark-Portal
// is the team's own project.

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const LINEAR_SLUG = process.argv[2] ?? "f12c1e4fa44b";
const CLIENT_NAME = process.argv[3] ?? "spark-portal";
const BUCKET = "documents_bucket";
const MAX_FILE_BYTES = 20 * 1024 * 1024;

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

const cloudEnv = readEnv("supabase/functions/.env");
const stackEnv = readEnv("docker/supabase/.env");

const CLOUD_URL = cloudEnv.get("PROJECT_URL");
const LOCAL_URL = "http://localhost:8000";
if (!CLOUD_URL?.includes(".supabase.co")) {
  console.error("supabase/functions/.env PROJECT_URL isn't the cloud project — stopping");
  process.exit(1);
}

const options = { auth: { persistSession: false }, db: { schema: "portal" } };
const cloud = createClient(CLOUD_URL, cloudEnv.get("SERVICE_SECRET_KEY"), options);
const local = createClient(LOCAL_URL, stackEnv.get("SERVICE_ROLE_KEY"), options);

// Rows for this client, whichever slug they were stored under.
const forClient = (query) =>
  query.or(`project_slug.ilike.${LINEAR_SLUG},project_slug.ilike.${CLIENT_NAME}`);

// documents.link is a public URL; the object's path is what follows the bucket.
function storagePath(link) {
  const marker = `/${BUCKET}/`;
  const at = link?.indexOf(marker) ?? -1;
  if (at === -1) return null;
  const path = link.slice(at + marker.length);
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}

// Local rows are owned by the local admin (cloud users don't exist here).
const { data: admin } = await local.from("users").select("id").eq("role", "admin").limit(1).maybeSingle();
if (!admin) {
  console.error("No local admin: run node docker/supabase/portal/seed-users.mjs first");
  process.exit(1);
}

// ── Documents ───────────────────────────────────────────────────────────────
const { data: documents, error: docsError } = await forClient(
  cloud.from("documents").select("file_name, link, category, size, project_slug, created_at"),
);
if (docsError) throw new Error(`cloud documents: ${docsError.message}`);

const { data: localDocs } = await forClient(local.from("documents").select("id, link"));
const localIdByPath = new Map((localDocs ?? []).map((d) => [storagePath(d.link), d.id]));

let copiedDocs = 0;
let skippedDocs = 0;
for (const doc of documents ?? []) {
  const path = storagePath(doc.link);
  if (!path) {
    console.log(`  skip (no file): ${doc.file_name}`);
    skippedDocs++;
    continue;
  }
  const { data: blob, error: downloadError } = await cloud.storage.from(BUCKET).download(path);
  if (downloadError || !blob) {
    console.log(`  skip (download failed): ${doc.file_name}`);
    skippedDocs++;
    continue;
  }
  if (blob.size > MAX_FILE_BYTES) {
    console.log(`  skip (over ${MAX_FILE_BYTES / 1024 / 1024} MB): ${doc.file_name}`);
    skippedDocs++;
    continue;
  }
  const { error: uploadError } = await local.storage
    .from(BUCKET)
    .upload(path, blob, { upsert: true, contentType: blob.type || "application/octet-stream" });
  if (uploadError) throw new Error(`local upload ${path}: ${uploadError.message}`);

  const row = {
    file_name: doc.file_name,
    link: local.storage.from(BUCKET).getPublicUrl(path).data.publicUrl,
    category: doc.category,
    size: doc.size,
    project_slug: doc.project_slug,
    created_at: doc.created_at,
    owner_id: admin.id,
    embeddings_complete: false,
  };
  const existingId = localIdByPath.get(path);
  const { error } = existingId
    ? await local.from("documents").update(row).eq("id", existingId)
    : await local.from("documents").insert(row);
  if (error) throw new Error(`local document ${doc.file_name}: ${error.message}`);
  copiedDocs++;
}

// ── Test cases ──────────────────────────────────────────────────────────────
const { data: tests, error: testsError } = await forClient(
  cloud.from("tests").select("id, project_slug, title, steps, created_by, created_at, updated_at"),
);
if (testsError) throw new Error(`cloud tests: ${testsError.message}`);

if (tests?.length) {
  // last_passed_execution_id points at executions that aren't copied.
  const rows = tests.map((t) => ({ ...t, last_passed_execution_id: null, embeddings_complete: false }));
  const { error } = await local.from("tests").upsert(rows, { onConflict: "id" });
  if (error) throw new Error(`local tests: ${error.message}`);
}

console.log(`Documents: ${copiedDocs} copied, ${skippedDocs} skipped (of ${documents?.length ?? 0})`);
console.log(`Tests: ${tests?.length ?? 0} copied`);
console.log("Next: embed them with the local backfills (see docs/LOCAL_SUPABASE.md).");
