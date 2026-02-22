// @ts-nocheck
import { stripe } from "./client.ts";
import { createUserFromStripe } from "./createUserFromStripe.ts";

export async function stripeWebhook(req: Request) {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const signature = req.headers.get("stripe-signature");
  const body = await req.text();

  let event;

  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature!,
      Deno.env.get("STRIPE_WEBHOOK_SECRET")!,
    );
  } catch (err) {
    console.error("❌ Webhook signature verification failed:", err.message);
    return new Response("Invalid signature", { status: 400 });
  }

  // ✅ Handle events
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;

    const customerId = session.customer;
    const subscriptionId = session.subscription;
    const email = session.customer_details?.email;

    console.log("✅ Subscription completed", {
      customerId,
      subscriptionId,
      email,
    });

    await createUserFromStripe({
      email,
      customerId,
      subscriptionId,
    });
  }

  return new Response(
    JSON.stringify({ received: true }),
    { headers: { "Content-Type": "application/json" } },
  );
}




