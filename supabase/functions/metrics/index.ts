// @ts-nocheck
import { serve } from "https://deno.land/std/http/server.ts";
import { getMetrics } from "./get-metrics.ts";
import { corsHeaders } from "../utils/headers.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  if (req.method === "GET") {
    return getMetrics(req);
  }

  return new Response("Not found", {
    status: 404,
    headers: corsHeaders,
  });
});
