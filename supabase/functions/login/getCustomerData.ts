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

  const { data, error } = await supabase
    .from("customers")
    .select(
      `
      id,
      email,
      linear_slug,
      linear_name,
      linear_initiative_id
      `,
    )
    .eq("email", email)
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
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}
