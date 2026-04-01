// @ts-nocheck

import { corsHeaders } from "../utils/headers.ts";
import { getCustomerData } from "./getCustomerData.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }
  try {
    const url = new URL(req.url);
    const { pathname } = url;

    if (req.method === "GET") {
      return getCustomerData(req);
    }
    return new Response(JSON.stringify({ error: "Route not found" }), {
      status: 404,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("[Customer API Error]", error);

    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  }
});
