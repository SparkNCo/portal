// @ts-nocheck
import { corsHeaders } from "../utils/headers.ts";
import { handleGenerateSuggestion } from "./generateSuggestion.ts";
import { handleGenerateAllSuggestions } from "./generateAllSuggestions.ts";
import { handleListSuggestions } from "./listSuggestions.ts";
import { handleAcceptSuggestion } from "./acceptSuggestion.ts";
import { handleDeclineSuggestion } from "./declineSuggestion.ts";
import { handleUpdateSuggestionMilestone } from "./updateSuggestionMilestone.ts";
import { handleUpdateSuggestionProject } from "./updateSuggestionProject.ts";

// /generate-all is the weekly cron target (see
// supabase/migrations/..._schedule_suggested_features_cron.sql); /generate
// stays available as a manual, single-project trigger (e.g. from Insomnia).
//
// Table-driven instead of an if/else chain — keeps adding a route a one-line
// change instead of growing the branch count SonarQube flags on this handler.
const ROUTES: { method: string; suffix: string; handle: (req: Request) => Promise<Response> }[] = [
  { method: "POST", suffix: "/generate-all", handle: handleGenerateAllSuggestions },
  { method: "POST", suffix: "/generate", handle: handleGenerateSuggestion },
  { method: "POST", suffix: "/accept", handle: handleAcceptSuggestion },
  { method: "POST", suffix: "/decline", handle: handleDeclineSuggestion },
  { method: "PATCH", suffix: "/milestone", handle: handleUpdateSuggestionMilestone },
  { method: "PATCH", suffix: "/project", handle: handleUpdateSuggestionProject },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const pathname = new URL(req.url).pathname;
    const route = ROUTES.find((r) => req.method === r.method && pathname.endsWith(r.suffix));

    let res: Response;
    if (route) {
      res = await route.handle(req);
    } else if (req.method === "GET") {
      res = await handleListSuggestions(req);
    } else {
      return new Response(JSON.stringify({ error: "Route not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await res.text();
    return new Response(body, {
      status: res.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[suggested-features API Error]", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
