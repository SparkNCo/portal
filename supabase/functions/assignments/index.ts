// @ts-nocheck
import { corsHeaders } from "../utils/headers.ts";
import { createAssignment } from "./createAssignment.ts";
import { getAssignmentsByCustomer } from "./getAssignmentsByCustomer.ts";

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

    if (req.method === "POST") {
      return createAssignment(req);
    }

    if (req.method === "GET") {
      return getAssignmentsByCustomer(req);
    }

    return new Response(JSON.stringify({ error: "Route not found" }), {
      status: 404,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("[Assignment API Error]", error);

    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  }
});
