// @ts-nocheck
// SDLC metrics phase 4: Code Coverage and Sonar Quality Gate are entered by
// hand by a developer or admin — nothing computes them. Built as its own
// endpoint (like `stripe-test` before it) so it never touches `dora`, the
// cron function that's already live and computing real metrics for every
// customer — this only ever writes to two columns (`code_coverage_details`,
// `sonar_quality_gate_details`) that `dora`'s cron never reads or writes,
// so there's no way for a cron run to overwrite a manually-entered value,
// or for this endpoint to affect the computed metrics.
import { supabase } from "../client.ts";
import { corsHeaders } from "../utils/headers.ts";
import { escapeIlike } from "../utils/slug.ts";

const schema = "portal";
const METRICS = ["code_coverage", "sonar_quality_gate"] as const;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method === "PATCH") return await handlePatch(req);

    return jsonResponse({ error: "Method not allowed" }, 405);
  } catch (error) {
    console.error("[manual-metrics] error", error);
    return jsonResponse({ error: error.message }, 500);
  }
});

// Only a developer or admin may record these — never trust a client-supplied
// identity for that check, resolve the caller from their own bearer token.
async function resolveAuthorizedCaller(req: Request) {
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return { error: "Missing bearer token" };

  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  const callerEmail = authData?.user?.email;
  if (authError || !callerEmail) return { error: "Unauthorized" };

  const { data: caller } = await supabase.schema(schema)
    .from("users")
    .select("role, email")
    .eq("email", callerEmail)
    .maybeSingle();

  if (caller?.role !== "admin" && caller?.role !== "developer") {
    return { error: "Only admins and developers can set this" };
  }

  return { caller };
}

const handlePatch = async (req: Request) => {
  const { caller, error: authError } = await resolveAuthorizedCaller(req);
  if (authError) return jsonResponse({ error: authError }, 403);

  const body = await req.json();
  const { linear_slug, metric, value } = body;

  if (!linear_slug) return jsonResponse({ error: "linear_slug is required" }, 400);
  if (!METRICS.includes(metric)) {
    return jsonResponse({ error: `metric must be one of: ${METRICS.join(", ")}` }, 400);
  }

  const validationError = validateValue(metric, value);
  if (validationError) return jsonResponse({ error: validationError }, 400);

  const column = `${metric}_details`;
  const detail = { value, updated_at: new Date().toISOString(), updated_by: caller.email };

  const { data, error } = await supabase.schema(schema)
    .from("dora_metrics")
    .update({ [column]: detail })
    .ilike("linear_slug", escapeIlike(linear_slug))
    .select("linear_slug, code_coverage_details, sonar_quality_gate_details")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) {
    return jsonResponse(
      { error: "No SDLC metrics found for this client yet — wait for the daily sync to run at least once first" },
      404,
    );
  }

  return jsonResponse(data);
};

function validateValue(metric: string, value: unknown): string | null {
  if (metric === "code_coverage") {
    const num = Number(value);
    if (!Number.isFinite(num) || num < 0 || num > 100) {
      return "code_coverage value must be a number between 0 and 100";
    }
    return null;
  }

  if (value !== "pass" && value !== "fail") {
    return "sonar_quality_gate value must be 'pass' or 'fail'";
  }
  return null;
}

const jsonResponse = (data: any, status = 200) => {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
};
