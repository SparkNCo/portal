// @ts-nocheck
import { serve } from "https://deno.land/std/http/server.ts";
import { createSubscriptionProduct } from "./createSubscriptionProduct.ts";
import { sendPaymentLink } from "./sendPaymentLink.ts";
import { stripeWebhook } from "./webhook.ts";
import { getClientData } from "./getClientData.ts";
import { createCustomerPortal } from "./createCustomerPortal.ts";

serve(async (req) => {
  const url = new URL(req.url);

  // You can extend this later with /webhook, /portal, etc.
  if (req.method === "GET" && url.pathname === "/stripe/client") {
    return getClientData(req);
  }

  if (req.method === "POST" && url.pathname === "/stripe/create-subscription-product") {
    return createSubscriptionProduct(req);
  }

  if (req.method === "POST" && url.pathname === "/stripe/send-payment-link") {
    return sendPaymentLink(req);
  }

  if (req.method === "POST" && url.pathname === "/stripe/webhook") {
    return stripeWebhook(req);
  }

  if (req.method === "POST" && url.pathname === "/stripe/create-customer-portal") {
    return createCustomerPortal(req);
  }

  return new Response("Not found", { status: 404 });
});
