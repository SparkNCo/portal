// @ts-nocheck
import { corsHeaders } from "../utils/headers.ts";
import { stripe } from "./client.ts";

// POST /stripe/cancel-subscription — cancels a subscription immediately.
export async function cancelSubscription(req: Request) {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const { subscription_id: subscriptionId } = await req.json();

    if (!subscriptionId) {
      return new Response(JSON.stringify({ error: "subscription_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[cancelSubscription] canceling subscription:", subscriptionId);
    const subscription = await stripe.subscriptions.cancel(subscriptionId);
    console.log("[cancelSubscription] subscription canceled:", subscription.id, subscription.status);

    return new Response(
      JSON.stringify({ id: subscription.id, status: subscription.status }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[cancelSubscription] unhandled error:", err?.message ?? err);
    return new Response(
      JSON.stringify({ error: "Internal server error", detail: err?.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
}
