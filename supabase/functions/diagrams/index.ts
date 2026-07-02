// @ts-nocheck
import { corsHeaders } from "../utils/headers.ts";
import { resolvePortalSchema } from "../utils/schema.ts";
import { createDiagram } from "./createDiagram.ts";
import { listDiagrams } from "./listDiagrams.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const schema = resolvePortalSchema(req);

    if (req.method === "GET") {
      const diagrams = await listDiagrams(url, schema);
      return jsonResponse(diagrams);
    }

    if (req.method === "POST") {
      const result = await createDiagram(req, schema);
      return jsonResponse(result);
    }

    return new Response("Method not allowed", { status: 405 });
  } catch (error) {
    console.error("[Supabase Error]", error);
    return jsonResponse({ error: error.message }, 500);
  }
});

const jsonResponse = (data: any, status = 200) => {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
};
