// @ts-nocheck

import { supabase } from "../client.ts";
import { stripe } from "./client.ts";
import { balanceSchema, getClientDataQuerySchema, invoiceSchema, paymentMethodSchema, subscriptionSchema } from "./zod.ts";

// 🔹 Consistent CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

export async function getClientData(req: Request) {
  // ✅ Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    const url = new URL(req.url);

    const parseResult = getClientDataQuerySchema.safeParse({ email: url.searchParams.get("email") });
    if (!parseResult.success) {
      return new Response(
        JSON.stringify({ error: "Invalid or missing email" }),
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }
    const { email } = parseResult.data;

    // 🔹 STEP 1: Fetch user from Supabase
    const { data: user, error } = await supabase
      .from("users")
      .select("subscription_id, customer_id")
      .eq("email", email)
      .single();

    if (error || !user?.customer_id || !user?.subscription_id) {
      return new Response(
        JSON.stringify({ error: "Stripe data not found for user" }),
        { 
          status: 404, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    const { customer_id, subscription_id } = user;

    // 🔹 STEP 2: Stripe calls
    const subscription = await stripe.subscriptions.retrieve(subscription_id);

    let upcomingInvoice = null;
    try {
      upcomingInvoice = await stripe.invoices.retrieveUpcoming({
        customer: customer_id,
        subscription: subscription_id,
      });
    } catch {
      upcomingInvoice = null;
    }

    const invoices = await stripe.invoices.list({
      customer: customer_id,
      limit: 10,
    });

    const paymentMethods = await stripe.paymentMethods.list({
      customer: customer_id,
      type: "card",
    });

    const customer = await stripe.customers.retrieve(customer_id);

    const openInvoices = await stripe.invoices.list({
      customer: customer_id,
      status: "open",
      limit: 5,
    });

    // 🔹 STEP 3: Build response
    const response = {
      subscription: subscriptionSchema.parse({
        id: subscription.id,
        status: subscription.status,
        currentPeriodStart: subscription.current_period_start,
        currentPeriodEnd: subscription.current_period_end,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        price: subscription.items.data[0]?.price,
      }),
      balance: balanceSchema.parse({
        amount: customer.balance,
        currency: customer.currency || "usd",
        hasPendingBalance: customer.balance > 0,
      }),
      openInvoices: openInvoices.data.map((inv) =>
        invoiceSchema.parse({
          id: inv.id,
          amountDue: inv.amount_due,
          dueDate: inv.due_date ?? null,
          hostedInvoiceUrl: inv.hosted_invoice_url ?? null,
        })
      ),
      upcomingInvoice: upcomingInvoice
        ? {
            amountDue: upcomingInvoice.amount_due,
            currency: upcomingInvoice.currency,
            nextPaymentAttempt: upcomingInvoice.next_payment_attempt,
          }
        : null,
      invoices: invoices.data.map((inv) => ({
        id: inv.id,
        status: inv.status,
        amountPaid: inv.amount_paid,
        amountDue: inv.amount_due,
        hostedInvoiceUrl: inv.hosted_invoice_url,
        invoicePdf: inv.invoice_pdf,
        created: inv.created,
      })),
      paymentMethod: paymentMethods.data[0]
        ? paymentMethodSchema.parse({
            brand: paymentMethods.data[0].card.brand,
            last4: paymentMethods.data[0].card.last4,
            expMonth: paymentMethods.data[0].card.exp_month,
            expYear: paymentMethods.data[0].card.exp_year,
          })
        : null,
    };

    return new Response(JSON.stringify(response), {
      headers: { 
        ...corsHeaders, 
        "Content-Type": "application/json" 
      },
    });
  } catch (err) {
    console.error("Stripe client error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { 
        ...corsHeaders, 
        "Content-Type": "application/json" 
      },
    });
  }
}