// @ts-nocheck

import { supabase } from "../client.ts";
import { corsHeaders } from "../utils/headers.ts";

export async function getCustomerData(req: Request) {
  const url = new URL(req.url);
  const email = url.searchParams.get("email");
  console.log("Fetching customer data for email:", email);

  if (!email) {
    return new Response(JSON.stringify({ error: "Email is required" }), {
      status: 400,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  }

  const { data, error } = await supabase.schema("portal")
    .from("users")
    .select(
      `
      id,
      email,
      linear_slug,
      clientName,
      initiative_ids
      `,
    )
    .eq("email", email)
    .eq("role", "customer")
    .maybeSingle();

  if (error) {
    console.error("Customer query error:", error);

    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  }

  if (!data) {
    return new Response(JSON.stringify({ error: "Customer not found" }), {
      status: 404,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  }

  const response = {
    ...data,
    linear_name: data.clientName,
    linear_initiative_id: data.initiative_ids?.[0] ?? null,
  };

  return new Response(JSON.stringify(response), {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}
