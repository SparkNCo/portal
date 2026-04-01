// @ts-nocheck

import { corsHeaders } from "../utils/headers.ts";
import { handleCreateLead } from "./handleCreateLead.ts";
import { handleGetLeads } from "./handleGetLeads.ts";
import { handleUpdateLead } from "./handleUpdateLead.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    switch (req.method) {
      case "GET":
        return await handleGetLeads(req);

      case "POST":
        return await handleCreateLead(req);

      case "PUT":
        return await handleUpdateLead(req);

      default:
        return new Response(JSON.stringify({ error: "Method not allowed" }), {
          status: 405,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        });
    }
  } catch (error) {
    console.error("[Leads API Error]", error);

    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  }
});
