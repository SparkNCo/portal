// @ts-nocheck
import { corsHeaders } from "../utils/headers.ts";
import { createProjectRequest } from "./createProjectRequest.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    let res: Response;

    if (req.method === "POST") {
      res = await createProjectRequest(req);
    } else {
      res = Response.json({ error: "Method not allowed" }, { status: 405 });
    }

    return new Response(res.body, {
      status: res.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[project-requests API Error]", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
