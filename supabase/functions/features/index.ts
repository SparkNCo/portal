// @ts-nocheck
import { serve } from "https://deno.land/std/http/server.ts";
import { fetchFeatures } from "./fetch-feature.ts";
import { createRequirements } from "./post-features.ts";
import { corsHeaders } from "../utils/headers.ts";

serve(async (req) => {
  // ✅ Handle preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  if (req.method === "GET") {
    return fetchFeatures(req);
  }

  if (req.method === "POST") {
    return createRequirements(req);
  }

  return new Response("Not found", {
    status: 404,
    headers: corsHeaders,
  });
});
