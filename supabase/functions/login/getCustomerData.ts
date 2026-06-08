// @ts-nocheck

import { supabase } from "../client.ts";
import { corsHeaders } from "../utils/headers.ts";

// `users.customer_id` may still hold legacy Stripe customer IDs (e.g. "cus_...")
// for rows that predate the customers table migration; only UUIDs match `customers.customer_id`.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
      customer_id,
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

  let clientInfo: { linear_slug: string | null; clientName: string | null } = {
    linear_slug: null,
    clientName: null,
  };

  if (data.customer_id && UUID_RE.test(data.customer_id)) {
    const { data: client, error: clientError } = await supabase.schema("portal")
      .from("customers")
      .select("linear_slug, clientName")
      .eq("customer_id", data.customer_id)
      .maybeSingle();

    if (clientError) {
      console.error("Client query error:", clientError);
    } else if (client) {
      clientInfo = client;
    }
  }

  const response = {
    ...data,
    linear_slug: clientInfo.linear_slug,
    clientName: clientInfo.clientName,
    linear_name: clientInfo.clientName,
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
