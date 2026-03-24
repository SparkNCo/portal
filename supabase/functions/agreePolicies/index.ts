// @ts-nocheck
import { corsHeaders } from "../utils/headers.ts";
import { checkApproval } from "./checkApproval.ts";
import { approvePolicy } from "./approvePolicy.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const { pathname } = url;

    // 🔹 GET /agreePolicies/check -> check if policies approved
    if (req.method === "GET" && pathname === "/agreePolicies/check") {
      return await checkApproval(req);
    }

    // 🔹 POST /agreePolicies/approve -> mark policies approved
    if (req.method === "POST" && pathname === "/agreePolicies/approve") {
      return await approvePolicy(req);
    }

    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[Agree Policies API Error]", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
