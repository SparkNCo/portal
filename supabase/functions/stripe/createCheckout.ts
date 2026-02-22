// @ts-nocheck
import { stripe } from "./client.ts";

export async function createCheckoutSession(req: Request) {
  try {
    const { email, price_id } = await req.json();

    if (!email || !price_id) {
      return new Response(
        JSON.stringify({ error: "email and price_id are required" }),
        { status: 400 },
      );
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer_email: email,

      line_items: [
        {
          price: price_id, 
          quantity: 1,
        },
      ],

      success_url: "http://localhost:3000/billing?success=true",
      cancel_url: "http://localhost:3000/billing?canceled=true",
    });

    return new Response(
      JSON.stringify({
        url: session.url,
      }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Stripe error:", error);

    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
    });
  }
}
