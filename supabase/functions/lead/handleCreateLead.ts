// @ts-nocheck

import { supabase } from "../client.ts";
import { corsHeaders } from "../utils/headers.ts";
import { LeadInsertSchema } from "./zod.ts";

export async function handleCreateLead(req: Request) {
  const body = await req.json();

  const parsed = LeadInsertSchema.safeParse(body);

  if (!parsed.success) {
    return new Response(JSON.stringify({ error: parsed.error.flatten() }), {
      status: 400,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  }

  const payload = {
    ...parsed.data,
    lead_id: parsed.data.lead_id ?? crypto.randomUUID(),
  };

  const { data, error } = await supabase
    .from("leads")
    .insert(payload)
    .select()
    .single();

  if (error) throw error;

  return new Response(JSON.stringify(data), {
    status: 201,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}
