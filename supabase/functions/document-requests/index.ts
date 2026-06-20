// @ts-nocheck
import { corsHeaders } from "../utils/headers.ts";
import { createDocumentRequest } from "./createDocumentRequest.ts";
import { markDocumentRequestDone } from "./markDocumentRequestDone.ts";
import { claimDocumentRequest } from "./claimDocumentRequest.ts";
import { releaseDocumentRequest } from "./releaseDocumentRequest.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    let res: Response;

    if (req.method === "POST") {
      res = await createDocumentRequest(req);
    } else if (req.method === "PATCH") {
      const body = await req.json();

      if (body.action === "claim") {
        res = await claimDocumentRequest(body);
      } else if (body.action === "release") {
        res = await releaseDocumentRequest(body);
      } else {
        res = await markDocumentRequestDone(body);
      }
    } else {
      res = Response.json({ error: "Method not allowed" }, { status: 405 });
    }

    return new Response(res.body, {
      status: res.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[document-requests API Error]", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
