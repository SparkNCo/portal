// @ts-nocheck

import { stripe } from "./client.ts";

export async function createSubscriptionProduct(req: Request) {
  try {
    const { name, amount, currency = "usd", interval = "month" } =
      await req.json();

    if (!name || !amount) {
      return new Response(
        JSON.stringify({ error: "name and amount are required" }),
        { status: 400 },
      );
    }

    // 1. Create product
    const product = await stripe.products.create({
      name,
    });

    // 2. Create recurring price
    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: amount,
      currency,
      recurring: {
        interval,
      },
    });

    return new Response(
      JSON.stringify({
        productId: product.id,
        priceId: price.id,
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
