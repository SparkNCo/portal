// @ts-nocheck
import { stripe } from "./client.ts";
import { sendEmail } from "../lib/mailer.ts";
import { SubscriptionEmailTemplateHtml } from "../utils/stripeLinkTemplate.ts";

export async function sendPaymentLink(req: Request) {
  try {
    const { email, price_id, initiativeId, userName } = await req.json();

    if (!email || !price_id) {
      return new Response(
        JSON.stringify({ error: "email and price_id are required" }),
        { status: 400 },
      );
    }

    // 1. Create payment link (subscription)
    const paymentLink = await stripe.paymentLinks.create({
      line_items: [
        {
          price: price_id,
          quantity: 1,
        },
      ],
      metadata: {
        initiativeId: initiativeId ?? "",
      },
    });

    // 2. Send email
    await sendEmail({
      to: email,
      subject: "Complete your Spark Portal subscription",
      html: SubscriptionEmailTemplateHtml({
        name: userName,
        paymentLink: paymentLink.url,
      }),
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Send payment link error:", error);

    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
    });
  }
}
