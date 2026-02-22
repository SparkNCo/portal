// @ts-nocheck
import { serve } from "https://deno.land/std/http/server.ts";
import { getByPasscode } from "./get-by-passcode.ts";
import { updateProposal } from "./update-proposal.ts";
import { signProposal } from "./sign-proposal.ts";
import { corsHeaders } from "../utils/headers.ts";

serve(async (req) => {
  // ✅ Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  if (req.method === "GET") {
    return getByPasscode(req);
  }

  if (req.method === "PATCH") {
    return updateProposal(req);
  }

  if (req.method === "POST") {
    return signProposal(req);
  }

  return new Response("Not found", {
    status: 404,
    headers: corsHeaders,
  });
});