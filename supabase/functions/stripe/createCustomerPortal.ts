// @ts-nocheck
import { supabase } from "../client.ts";
import { corsHeaders } from "../utils/headers.ts";
import { stripe } from "./client.ts";
import { paymentMethodBodySchema, portalSessionSchema } from "./zod.ts";

export async function createCustomerPortal(req: Request, schema: string) {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }
  try {
    const body = await req.json();
    const parseResult = paymentMethodBodySchema.safeParse(body);

    if (!parseResult.success) {
      return new Response(
        JSON.stringify({ error: "Invalid or missing email" }),
        { status: 400, headers: corsHeaders },
      );
    }

    const { email } = parseResult.data;

    const { data: user, error } = await supabase.schema(schema)
      .from("users")
      .select("customer_id")
      .eq("email", email)
      .single();

    if (error || !user?.customer_id) {
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 404,
        headers: corsHeaders,
      });
    }

    // `users.customer_id` references `customers.customer_id` — the actual
    // Stripe customer id lives on `customers.stripe_customer_id`.
    const { data: customer, error: customerError } = await supabase.schema(schema)
      .from("customers")
      .select("stripe_customer_id")
      .eq("customer_id", user.customer_id)
      .single();

    if (customerError || !customer?.stripe_customer_id) {
      return new Response(
        JSON.stringify({ error: "No Stripe customer linked to this account" }),
        { status: 404, headers: corsHeaders },
      );
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customer.stripe_customer_id,
      return_url: "http://localhost:3000/dashboard/settings",
    });

    const validatedSession = portalSessionSchema.parse({
      url: portalSession.url,
    });

    return new Response(JSON.stringify(validatedSession), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  } catch (err) {
    console.error("Stripe portal error:", err);

    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: corsHeaders,
    });
  }
}
