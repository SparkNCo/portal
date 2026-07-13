// @ts-nocheck
import { corsHeaders } from "../utils/headers.ts";
import { createDesignResource } from "./createDesignResource.ts";
import { listDesignResources } from "./listDesignResources.ts";
import { updateDesignResource } from "./updateDesignResource.ts";
import { deleteDesignResource } from "./deleteDesignResource.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const schema = "portal";

    if (req.method === "GET") {
      const resources = await listDesignResources(url, schema);
      return jsonResponse(resources);
    }

    if (req.method === "POST") {
      const result = await createDesignResource(req, schema);
      return jsonResponse(result);
    }

    if (req.method === "PATCH") {
      const result = await updateDesignResource(req, schema);
      return jsonResponse(result);
    }

    if (req.method === "DELETE") {
      const result = await deleteDesignResource(req, schema);
      return jsonResponse(result);
    }

    return new Response("Method not allowed", { status: 405 });
  } catch (error) {
    console.error("[design-resources error]", error);
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
