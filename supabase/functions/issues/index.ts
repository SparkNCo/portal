// @ts-nocheck
import { corsHeaders } from "../utils/headers.ts";
import { handleGetIssues } from "./fetchIssues.ts";
import { handleAddComment, handleUpdateState } from "./updateIsste.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    let res: Response;

    if (req.method === "GET") {
      res = await handleGetIssues(req);
    } else if (req.method === "POST") {
      res = await handleAddComment(req);
    } else if (req.method === "PATCH") {
      res = await handleUpdateState(req);
    } else {
      res = Response.json({ error: "Method not allowed" }, { status: 405 });
    }

    return new Response(res.body, {
      status: res.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[Issues API Error]", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
