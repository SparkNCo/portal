// @ts-nocheck
// SPA-384: manual vs automatic invoicing toggle, and (while automatic) the
// ability to set/edit invoice frequency + amount. Built as its own endpoint
// so it can be tested independently of `users`/`stripe` (already deployed
// and in use for other testing) — nothing in this file is imported by, or
// imports from, those functions' route logic, only the shared `client.ts`/
// `utils/headers.ts` helpers every function already uses. Intended to be
// folded into `users`/`stripe` once this is verified.
//
// Switching a customer to "manual" pauses collection on their active Stripe
// subscription(s) (billing stays intact, Stripe just stops trying to charge
// it) so the admin can invoice them outside the portal. Switching back to
// "automatic" resumes collection.
//
// While automatic, invoice_amount/invoice_interval/invoice_interval_count
// describe what the customer should be billed and how often. Editing any of
// them (re)creates a Stripe recurring Price with those terms and swaps it
// onto the customer's existing subscription — Stripe prices are immutable,
// so "editing" a price always means creating a new one and re-pointing the
// subscription item at it, with proration off so nothing is charged early.
// If the customer has no subscription yet, the values are just saved for
// whenever one exists — there's no auto-create-a-subscription path here.
import { supabase } from "../client.ts";
import { corsHeaders } from "../utils/headers.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

const schema = "portal";
const INTERVALS = ["day", "week", "month", "year"];
const CUSTOMER_COLUMNS =
  "customer_id, stripe_customer_id, billing_mode, invoice_amount_cents, invoice_interval, invoice_interval_count";

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
    console.error("[stripe-edit] error", error);
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
    .select(CUSTOMER_COLUMNS)
    .eq("customer_id", customerId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return jsonResponse({ error: "Customer not found" }, 404);

  return jsonResponse(formatCustomer(data));
};

const handlePatch = async (req: Request) => {
  const body = await req.json();
  const { customer_id, billing_mode } = body;

  if (!customer_id) {
    return jsonResponse({ error: "customer_id is required" }, 400);
  }

  const { data: customer, error: customerError } = await supabase
    .schema(schema)
    .from("customers")
    .select(CUSTOMER_COLUMNS)
    .eq("customer_id", customer_id)
    .maybeSingle();

  if (customerError) throw new Error(customerError.message);
  if (!customer) return jsonResponse({ error: "Customer not found" }, 404);

  const validation = validatePatchBody(body, customer);
  if (validation.error) return jsonResponse({ error: validation.error }, 400);

  const { updateFields } = validation;
  if (Object.keys(updateFields).length === 0) {
    return jsonResponse({ error: "No fields to update" }, 400);
  }

  // Persist first, mutate Stripe second. Previously this was the other way
  // around — if the DB write below failed after Stripe already changed,
  // `customers` would silently disagree with reality forever (e.g. Stripe
  // collection paused while billing_mode still read "automatic", so the UI
  // kept showing the Stripe panels and nobody could tell the client had
  // stopped being charged). Now, if the Stripe calls fail instead, the row
  // is reverted back to its pre-update values so it never drifts silently —
  // see the catch block below.
  const { data, error } = await supabase.schema(schema)
    .from("customers")
    .update(updateFields)
    .eq("customer_id", customer_id)
    .select(CUSTOMER_COLUMNS)
    .single();

  if (error) throw new Error(error.message);

  let pausedSubscriptions: string[] = [];
  let resumedSubscriptions: string[] = [];
  let priceSync: { applied: boolean; subscriptionId?: string; priceId?: string } = {
    applied: false,
  };

  try {
    ({ pausedSubscriptions, resumedSubscriptions } = await applyBillingModeChange(
      customer,
      billing_mode,
    ));
    priceSync = await applyInvoiceSettingsChange(customer, updateFields);
  } catch (stripeError) {
    // Best-effort revert so the DB doesn't end up claiming a change that
    // never actually took effect in Stripe. If the revert itself fails too,
    // the row is genuinely stuck out of sync — that needs a human, so it's
    // surfaced as a distinct, loud error rather than a generic 500.
    const { error: revertError } = await supabase.schema(schema)
      .from("customers")
      .update(revertValues(customer, updateFields))
      .eq("customer_id", customer_id);

    if (revertError) {
      console.error(
        "[stripe-edit] Stripe update failed AND revert failed — customer row is out of sync with Stripe",
        { customer_id, stripeError: stripeError.message, revertError: revertError.message },
      );
      throw new Error(
        `Stripe update failed and the database could not be reverted — customer ${customer_id} needs manual reconciliation. Original error: ${stripeError.message}`,
      );
    }

    throw new Error(stripeError.message);
  }

  return jsonResponse({
    ...formatCustomer(data),
    pausedSubscriptions,
    resumedSubscriptions,
    priceSync,
  });
};

// Builds the revert payload for a failed Stripe call — same keys as
// `updateFields`, but with each value taken from the pre-update `customer`
// row instead, so the DB update above can be undone field-for-field.
function revertValues(customer: any, updateFields: Record<string, unknown>) {
  const original: Record<string, unknown> = {};
  for (const key of Object.keys(updateFields)) {
    original[key] = customer[key] ?? null;
  }
  return original;
}

// Pure validation — figures out which columns this request actually wants to
// change and rejects anything malformed, without touching Stripe or the DB.
function validatePatchBody(
  body: any,
  customer: any,
): { error?: string; updateFields: Record<string, unknown> } {
  const { billing_mode, invoice_amount, invoice_interval, invoice_interval_count } = body;
  const updateFields: Record<string, unknown> = {};

  if (billing_mode !== undefined) {
    if (billing_mode !== "automatic" && billing_mode !== "manual") {
      return { error: "billing_mode must be 'automatic' or 'manual'", updateFields };
    }
    updateFields.billing_mode = billing_mode;
  }

  const wantsInvoiceSettings =
    invoice_amount !== undefined ||
    invoice_interval !== undefined ||
    invoice_interval_count !== undefined;

  if (!wantsInvoiceSettings) return { updateFields };

  const effectiveBillingMode = billing_mode ?? customer.billing_mode ?? "automatic";
  if (effectiveBillingMode !== "automatic") {
    return {
      error:
        "invoice_amount/invoice_interval/invoice_interval_count can only be set while billing_mode is 'automatic'",
      updateFields,
    };
  }

  const amountError = applyAmountField(updateFields, invoice_amount);
  if (amountError) return { error: amountError, updateFields };

  const intervalError = applyIntervalField(updateFields, invoice_interval);
  if (intervalError) return { error: intervalError, updateFields };

  const countError = applyIntervalCountField(updateFields, invoice_interval_count);
  if (countError) return { error: countError, updateFields };

  return { updateFields };
}

function applyAmountField(updateFields: Record<string, unknown>, invoice_amount: unknown) {
  if (invoice_amount === undefined) return null;
  const amount = Number(invoice_amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return "invoice_amount must be a positive number";
  }
  updateFields.invoice_amount_cents = Math.round(amount * 100);
  return null;
}

function applyIntervalField(updateFields: Record<string, unknown>, invoice_interval: unknown) {
  if (invoice_interval === undefined) return null;
  if (!INTERVALS.includes(invoice_interval as string)) {
    return `invoice_interval must be one of: ${INTERVALS.join(", ")}`;
  }
  updateFields.invoice_interval = invoice_interval;
  return null;
}

function applyIntervalCountField(
  updateFields: Record<string, unknown>,
  invoice_interval_count: unknown,
) {
  if (invoice_interval_count === undefined) return null;
  const count = Number(invoice_interval_count);
  if (!Number.isInteger(count) || count <= 0) {
    return "invoice_interval_count must be a positive integer";
  }
  updateFields.invoice_interval_count = count;
  return null;
}

// Pauses/resumes Stripe collection when billing_mode actually changed and a
// Stripe customer is on file. No-op otherwise.
async function applyBillingModeChange(customer: any, billing_mode: string | undefined) {
  const result = { pausedSubscriptions: [] as string[], resumedSubscriptions: [] as string[] };

  if (billing_mode === undefined) return result;
  if (customer.billing_mode === billing_mode) return result;
  if (!customer.stripe_customer_id) return result;

  if (billing_mode === "manual") {
    result.pausedSubscriptions = await pauseCollection(customer.stripe_customer_id);
  } else {
    result.resumedSubscriptions = await resumeCollection(customer.stripe_customer_id);
  }

  return result;
}

// Syncs the customer's Stripe subscription price when invoice settings
// changed and both an amount and an interval are known (from this request or
// what's already saved). No-op otherwise.
async function applyInvoiceSettingsChange(
  customer: any,
  updateFields: Record<string, unknown>,
): Promise<{ applied: boolean; subscriptionId?: string; priceId?: string }> {
  const touchesInvoiceSettings =
    "invoice_amount_cents" in updateFields ||
    "invoice_interval" in updateFields ||
    "invoice_interval_count" in updateFields;

  if (!touchesInvoiceSettings || !customer.stripe_customer_id) {
    return { applied: false };
  }

  const effectiveAmountCents =
    (updateFields.invoice_amount_cents as number | undefined) ?? customer.invoice_amount_cents;
  const effectiveInterval =
    (updateFields.invoice_interval as string | undefined) ?? customer.invoice_interval;
  const effectiveIntervalCount =
    (updateFields.invoice_interval_count as number | undefined) ??
    customer.invoice_interval_count ??
    1;

  if (!effectiveAmountCents || !effectiveInterval) {
    return { applied: false };
  }

  return syncSubscriptionPrice(
    customer.stripe_customer_id,
    effectiveAmountCents,
    effectiveInterval,
    effectiveIntervalCount,
  );
}

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
    console.log("[stripe-edit] pausing collection on subscription", sub.id);
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
    console.log("[stripe-edit] resuming collection on subscription", sub.id);
    await stripe.subscriptions.update(sub.id, { pause_collection: "" });
    resumed.push(sub.id);
  }

  return resumed;
}

// Creates a new recurring Price with the given amount/frequency and swaps it
// onto the customer's existing subscription item. Stripe prices can't be
// edited in place, so "editing" always means: new price, re-point the
// subscription at it, no proration (don't charge/credit for the switch
// itself — the new price just takes effect on the next invoice).
async function syncSubscriptionPrice(
  stripeCustomerId: string,
  amountCents: number,
  interval: string,
  intervalCount: number,
): Promise<{ applied: boolean; subscriptionId?: string; priceId?: string }> {
  const subscriptions = await stripe.subscriptions.list({
    customer: stripeCustomerId,
    status: "all",
  });

  // Stripe won't let a canceled subscription's items be updated (it throws),
  // so only ever pick a non-canceled one — falling back to data[0] regardless
  // of status would surface that as an unhandled 500 instead of the graceful
  // "no subscription yet" path below.
  const subscription = subscriptions.data.find((sub) => sub.status !== "canceled");

  const itemId = subscription?.items?.data?.[0]?.id;
  if (!subscription || !itemId) {
    // No subscription to attach a price to yet — settings are still saved to
    // `customers`, they'll just need to be applied whenever a subscription
    // is created (e.g. via the existing renew-subscription flow).
    return { applied: false };
  }

  console.log(
    "[stripe-edit] creating new price",
    { amountCents, interval, intervalCount },
    "for subscription",
    subscription.id,
  );
  const price = await stripe.prices.create({
    unit_amount: amountCents,
    currency: subscription.currency ?? "usd",
    recurring: { interval, interval_count: intervalCount },
    product_data: { name: `Portal invoice — ${stripeCustomerId}` },
  });

  await stripe.subscriptions.update(subscription.id, {
    items: [{ id: itemId, price: price.id }],
    proration_behavior: "none",
  });

  return { applied: true, subscriptionId: subscription.id, priceId: price.id };
}

const formatCustomer = (data: any) => ({
  ...data,
  billing_mode: data.billing_mode ?? "automatic",
  invoice_amount:
    typeof data.invoice_amount_cents === "number"
      ? data.invoice_amount_cents / 100
      : null,
});

const jsonResponse = (data: any, status = 200) => {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
};
