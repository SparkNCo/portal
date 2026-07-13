// @ts-nocheck
import { corsHeaders } from "../utils/headers.ts";
import { verifyGithubSignature } from "./verifySignature.ts";
import { parseQualifyingBranch } from "../dora/branch.ts";
import { upsertBranchCreatedEvent } from "../dora/db.ts";

const SCHEMA = "portal";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: corsHeaders,
    });
  }

  const secret = Deno.env.get("GITHUB_WEBHOOK_SECRET");
  if (!secret) {
    console.error("❌ Missing GITHUB_WEBHOOK_SECRET env var");
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 500,
      headers: corsHeaders,
    });
  }

  const rawBody = await req.text();
  const signature = req.headers.get("x-hub-signature-256");

  const validSignature = await verifyGithubSignature(rawBody, signature, secret);
  if (!validSignature) {
    console.warn("⚠️ Rejected webhook delivery: invalid signature");
    return new Response(JSON.stringify({ error: "Invalid signature" }), {
      status: 401,
      headers: corsHeaders,
    });
  }

  const eventType = req.headers.get("x-github-event");

  // Branch creation is the only signal this endpoint derives DORA state from;
  // every other GitHub event type is acknowledged but otherwise ignored.
  if (eventType !== "create") {
    return new Response(JSON.stringify({ received: true, ignored: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: corsHeaders,
    });
  }

  if (payload.ref_type !== "branch") {
    return new Response(JSON.stringify({ received: true, ignored: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const branchName: string | undefined = payload.ref;
  const repo: string | undefined = payload.repository?.full_name;
  const qualifying = parseQualifyingBranch(branchName);

  if (!qualifying || !repo) {
    console.log(`ℹ️ Ignoring non-qualifying branch: ${branchName}`);
    return new Response(JSON.stringify({ received: true, ignored: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // Deliveries arrive essentially in real time, so the moment the webhook
    // is received is used directly as the branch creation timestamp.
    await upsertBranchCreatedEvent(SCHEMA, repo, branchName, qualifying.linearId, qualifying.type, new Date().toISOString());
  } catch (error) {
    console.error("❌ Failed to persist branch created event:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }

  console.log(`✅ Recorded branch creation: ${repo}#${branchName} → ${qualifying.linearId}`);
  return new Response(JSON.stringify({ received: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
