// @ts-nocheck
import { serve } from "https://deno.land/std/http/server.ts";
import { createSubscriptionProduct } from "./createSubscriptionProduct.ts";
import { sendPaymentLink } from "./sendPaymentLink.ts";
import { stripeWebhook } from "./webhook.ts";
import { getClientData } from "./getClientData.ts";
import { createCustomerPortal } from "./createCustomerPortal.ts";
import { renewSubscription } from "./renewSubscription.ts";
import { cancelSubscription } from "./cancelSubscription.ts";
import { corsHeaders } from "../utils/headers.ts";

serve(async (req) => {
  const url = new URL(req.url);
  const schema = "portal";

  // ✅ GLOBAL CORS HANDLER
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  if (req.method === "GET" && url.pathname === "/stripe/client") {
    return getClientData(req);
  }

  // if (
  //   req.method === "POST" &&
  //   url.pathname === "/stripe/create-subscription-product"
  // ) {
  //   return createSubscriptionProduct(req);
  // }

  if (req.method === "POST" && url.pathname === "/stripe/send-payment-link") {
    return sendPaymentLink(req);
  }

  if (req.method === "POST" && url.pathname === "/stripe/webhook") {
    return stripeWebhook(req);
  }

  if (
    // updatePaymentMethod
    req.method === "POST" &&
    url.pathname === "/stripe/create-customer-portal"
  ) {
    return createCustomerPortal(req, schema);
  }

  if (req.method === "POST" && url.pathname === "/stripe/renew-subscription") {
    return renewSubscription(req);
  }

  if (req.method === "POST" && url.pathname === "/stripe/cancel-subscription") {
    return cancelSubscription(req);
  }

  return new Response("Not found", {
    status: 404,
    headers: corsHeaders, // ✅ ALSO ADD HERE
  });
});
