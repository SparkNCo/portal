// @ts-nocheck
import { corsHeaders } from "../utils/headers.ts";
import { LeadUpdateSchema } from "./zod.ts";

export async function handleUpdateLead(req: Request) {
  const body = await req.json();

  const parsed = LeadUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return new Response(JSON.stringify({ error: parsed.error.flatten() }), {
      status: 400,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  }

  const { id, lead_id, ...updates } = parsed.data;

  let query = supabase.from("leads").update(updates);

  if (id) {
    query = query.eq("id", id);
  } else if (lead_id) {
    query = query.eq("lead_id", lead_id);
  }

  const { data, error } = await query.select().single();

  if (error) throw error;

  return new Response(JSON.stringify(data), {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}
