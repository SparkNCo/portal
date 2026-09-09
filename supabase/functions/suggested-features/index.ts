// @ts-nocheck
import { corsHeaders } from "../utils/headers.ts";
import { handleGenerateSuggestion } from "./generateSuggestion.ts";
import { handleListSuggestions } from "./listSuggestions.ts";
import { handleAcceptSuggestion } from "./acceptSuggestion.ts";
import { handleDeclineSuggestion } from "./declineSuggestion.ts";

// No cron wiring yet (see ticket notes) — /generate is triggered manually
// (e.g. from Insomnia) for one project at a time while this gets tested.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const pathname = new URL(req.url).pathname;
    let res: Response;

    if (req.method === "POST" && pathname.endsWith("/generate")) {
      res = await handleGenerateSuggestion(req);
    } else if (req.method === "POST" && pathname.endsWith("/accept")) {
      res = await handleAcceptSuggestion(req);
    } else if (req.method === "POST" && pathname.endsWith("/decline")) {
      res = await handleDeclineSuggestion(req);
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
