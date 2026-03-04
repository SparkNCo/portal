// @ts-nocheck

import { corsHeaders } from "../utils/headers.ts";
import { analyzeCurrentState } from "./analyze-current-state.ts";
import { analyzeIdea } from "./analyze-idea.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    const url = new URL(req.url);
    console.log(url);

    // 🔹 POST /storage
    const type = url.searchParams.get("type");
    console.log(type);

    if (req.method === "POST") {
      if (type === "idea") {
        return await analyzeIdea(req);
      }

      if (type === "current-state") {
        return await analyzeCurrentState(req);
      }
    }

    // ❌ Not found
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("[Storage API Error]", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  }
});
