// @ts-nocheck
// SPA-384: manual vs automatic invoicing toggle, built as its own endpoint so
// it can be tested independently of `users`/`stripe` (already deployed and in
// use for other testing) — nothing in this file is imported by, or imports
// from, those functions' route logic, only the shared `client.ts`/
// `utils/headers.ts` helpers every function already uses. Intended to be
// folded into `users`/`stripe` once this is verified.
//
// Switching a customer to "manual" pauses collection on their active Stripe
// subscription(s) (billing stays intact, Stripe just stops trying to charge
// it) so the admin can invoice them outside the portal. Switching back to
// "automatic" resumes collection.
import { supabase } from "../client.ts";
import { corsHeaders } from "../utils/headers.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

const schema = "portal";

// Same fetch-based client Stripe/Supabase document for Deno's Edge Runtime —
// duplicated here rather than imported from `../stripe/client.ts` to keep
// this endpoint fully self-contained.
const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method === "GET") return await handleGet(req);
    if (req.method === "PATCH") return await handlePatch(req);

    return jsonResponse({ error: "Method not allowed" }, 405);
  } catch (error) {
    console.error("[stripe-test] error", error);
    return jsonResponse({ error: error.message }, 500);
  }
});

const handleGet = async (req: Request) => {
  const url = new URL(req.url);
  const customerId = url.searchParams.get("customer_id");

  if (!customerId) {
    return jsonResponse({ error: "customer_id is required" }, 400);
  }

  const { data, error } = await supabase.schema(schema)
    .from("customers")
    .select("customer_id, stripe_customer_id, billing_mode")
    .eq("customer_id", customerId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return jsonResponse({ error: "Customer not found" }, 404);

  return jsonResponse({ ...data, billing_mode: data.billing_mode ?? "automatic" });
};

const handlePatch = async (req: Request) => {
  const body = await req.json();
  const { customer_id, billing_mode } = body;

  if (!customer_id) {
    return jsonResponse({ error: "customer_id is required" }, 400);
  }

  if (billing_mode !== "automatic" && billing_mode !== "manual") {
    return jsonResponse(
      { error: "billing_mode must be 'automatic' or 'manual'" },
      400,
    );
  }

  const { data: customer, error: customerError } = await supabase
    .schema(schema)
    .from("customers")
    .select("customer_id, stripe_customer_id, billing_mode")
    .eq("customer_id", customer_id)
    .maybeSingle();

  if (customerError) throw new Error(customerError.message);
  if (!customer) return jsonResponse({ error: "Customer not found" }, 404);

  let pausedSubscriptions: string[] = [];
  let resumedSubscriptions: string[] = [];

  // Only touch Stripe if this actually changes the mode and a Stripe
  // customer is on file — nothing to pause/resume otherwise.
  if (customer.stripe_customer_id && customer.billing_mode !== billing_mode) {
    if (billing_mode === "manual") {
      pausedSubscriptions = await pauseCollection(customer.stripe_customer_id);
    } else {
      resumedSubscriptions = await resumeCollection(customer.stripe_customer_id);
    }
  }

  const { data, error } = await supabase.schema(schema)
    .from("customers")
    .update({ billing_mode })
    .eq("customer_id", customer_id)
    .select("customer_id, stripe_customer_id, billing_mode")
    .single();

  if (error) throw new Error(error.message);

  return jsonResponse({ ...data, pausedSubscriptions, resumedSubscriptions });
};

// Pauses collection on every active/trialing/past_due subscription for this
// Stripe customer. `behavior: "void"` leaves invoices uncollected rather than
// marking them uncollectible — nothing is written off, it's just not charged
// while paused.
async function pauseCollection(stripeCustomerId: string): Promise<string[]> {
  const subscriptions = await stripe.subscriptions.list({
    customer: stripeCustomerId,
    status: "all",
  });

  const toPause = subscriptions.data.filter((sub) =>
    ["active", "trialing", "past_due"].includes(sub.status) &&
    !sub.pause_collection,
  );

  const paused: string[] = [];
  for (const sub of toPause) {
    console.log("[stripe-test] pausing collection on subscription", sub.id);
    await stripe.subscriptions.update(sub.id, {
      pause_collection: { behavior: "void" },
    });
    paused.push(sub.id);
  }

  return paused;
}

// Resumes collection on every subscription for this Stripe customer that was
// previously paused.
async function resumeCollection(stripeCustomerId: string): Promise<string[]> {
  const subscriptions = await stripe.subscriptions.list({
    customer: stripeCustomerId,
    status: "all",
  });

  const toResume = subscriptions.data.filter((sub) => sub.pause_collection);

  const resumed: string[] = [];
  for (const sub of toResume) {
    console.log("[stripe-test] resuming collection on subscription", sub.id);
    await stripe.subscriptions.update(sub.id, { pause_collection: "" });
    resumed.push(sub.id);
  }

  return resumed;
}

const jsonResponse = (data: any, status = 200) => {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
};
