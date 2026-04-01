// @ts-nocheck
import { supabase } from "../client.ts";
import { corsHeaders } from "../utils/headers.ts";

export async function handleGetLeads(req: Request) {
  const { searchParams } = new URL(req.url);

  const leadId = searchParams.get("lead_id");

  let query = supabase.from("leads").select("*");

  if (leadId) {
    query = query.eq("lead_id", leadId);
  }

  const { data, error } = await query;

  if (error) throw error;

  return new Response(JSON.stringify(data), {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}
