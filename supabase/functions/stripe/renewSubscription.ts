// @ts-nocheck
import { corsHeaders } from "../utils/headers.ts";
import { stripe } from "./client.ts";

// POST /stripe/renew-subscription — starts a brand-new Subscription for a
// customer whose only Stripe history is standalone charges (no Subscription
// object ever existed, or the old one is canceled/unpaid/incomplete_expired).
// Charges don't carry a price/product reference — that only exists on
// Invoices and Subscriptions — so instead of requiring a hardcoded price_id,
// this matches a recurring Price in the catalog by amount + currency against
// the customer's most recent charge, and subscribes them to that using the
// card already on file.
export async function renewSubscription(req: Request) {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const { customer_id: stripeCustomerId } = await req.json();

    if (!stripeCustomerId) {
      return new Response(JSON.stringify({ error: "customer_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[renewSubscription] fetching most recent charge for", stripeCustomerId);
    const charges = await stripe.charges.list({ customer: stripeCustomerId, limit: 1 });
    const lastCharge = charges.data[0];

    if (!lastCharge) {
      return new Response(
        JSON.stringify({ error: "No previous payments found for this customer — nothing to renew" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log(
      "[renewSubscription] last charge amount:", lastCharge.amount,
      "currency:", lastCharge.currency,
    );

    console.log("[renewSubscription] searching recurring prices for a match...");
    const prices = await stripe.prices.list({ active: true, limit: 100 });
    const matchingPrice = prices.data.find(
      (p) =>
        p.recurring &&
        p.unit_amount === lastCharge.amount &&
        p.currency === lastCharge.currency,
    );

    if (!matchingPrice) {
      return new Response(
        JSON.stringify({
          error: `No active recurring price found matching ${(lastCharge.amount / 100).toFixed(2)} ${lastCharge.currency.toUpperCase()}`,
        }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log("[renewSubscription] matched price:", matchingPrice.id);

    const paymentMethods = await stripe.paymentMethods.list({
      customer: stripeCustomerId,
      type: "card",
    });
    const defaultPaymentMethod = paymentMethods.data[0]?.id;

    if (!defaultPaymentMethod) {
      return new Response(
        JSON.stringify({ error: "Customer has no card on file to charge" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log("[renewSubscription] creating subscription with payment method:", defaultPaymentMethod);
    const subscription = await stripe.subscriptions.create({
      customer: stripeCustomerId,
      items: [{ price: matchingPrice.id }],
      default_payment_method: defaultPaymentMethod,
    });

    console.log("[renewSubscription] subscription created:", subscription.id, subscription.status);

    return new Response(
      JSON.stringify({ id: subscription.id, status: subscription.status }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[renewSubscription] unhandled error:", err?.message ?? err);
    return new Response(
      JSON.stringify({ error: "Internal server error", detail: err?.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
}
