// @ts-nocheck

import { corsHeaders } from "../utils/headers.ts";
import { stripe } from "./client.ts";
import { balanceSchema, getClientDataQuerySchema, invoiceSchema, paymentMethodSchema, subscriptionSchema } from "./zod.ts";

export async function getClientData(req: Request) {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    const url = new URL(req.url);
    console.log("[getClientData] incoming request:", req.method, url.pathname + url.search);
    console.log("[getClientData] STRIPE_SECRET_KEY present:", !!Deno.env.get("STRIPE_SECRET_KEY"));

    const rawCustomerId = url.searchParams.get("customer_id");
    console.log("[getClientData] raw customer_id param:", rawCustomerId);

    const parseResult = getClientDataQuerySchema.safeParse({ customer_id: rawCustomerId });
    if (!parseResult.success) {
      console.log("[getClientData] validation failed:", parseResult.error.flatten());
      return new Response(
        JSON.stringify({ error: "Invalid or missing customer_id" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }
    const { customer_id: stripeCustomerId } = parseResult.data;
    console.log("[getClientData] validated customer_id:", stripeCustomerId);

    // 🔹 STEP 1: Find active subscription, fall back to most recent canceled one
    console.log("[getClientData] fetching active subscriptions...");
    const activeSubscriptions = await stripe.subscriptions.list({
      customer: stripeCustomerId,
      status: "active",
      limit: 1,
    });

    let subscription = activeSubscriptions.data[0] ?? null;

    if (subscription) {
      console.log("[getClientData] active subscription id:", subscription.id, "status:", subscription.status);
    } else {
      console.log("[getClientData] no active subscription, fetching most recent canceled subscription...");
      const canceledSubscriptions = await stripe.subscriptions.list({
        customer: stripeCustomerId,
        status: "canceled",
        limit: 1,
      });
      subscription = canceledSubscriptions.data[0] ?? null;
      if (subscription) {
        console.log("[getClientData] found canceled subscription id:", subscription.id, "status:", subscription.status);
      } else {
        console.log("[getClientData] no subscriptions found at all for customer:", stripeCustomerId);
      }
    }

    let upcomingInvoice = null;
    if (subscription?.status === "active") {
      try {
        console.log("[getClientData] fetching upcoming invoice...");
        upcomingInvoice = await stripe.invoices.retrieveUpcoming({
          customer: stripeCustomerId,
          subscription: subscription.id,
        });
        console.log("[getClientData] upcoming invoice amount_due:", upcomingInvoice.amount_due);
      } catch (upcomingErr) {
        console.log("[getClientData] no upcoming invoice:", upcomingErr?.message);
        upcomingInvoice = null;
      }
    }

    console.log("[getClientData] fetching invoice history...");
    const invoices = await stripe.invoices.list({
      customer: stripeCustomerId,
      limit: 100,
    });
    console.log("[getClientData] invoices fetched:", invoices.data.length);

    console.log("[getClientData] fetching payment methods...");
    const paymentMethods = await stripe.paymentMethods.list({
      customer: stripeCustomerId,
      type: "card",
    });
    console.log("[getClientData] payment methods found:", paymentMethods.data.length);

    console.log("[getClientData] fetching customer record...");
    const customer = await stripe.customers.retrieve(stripeCustomerId);
    console.log("[getClientData] customer balance:", (customer as any).balance);

    console.log("[getClientData] fetching open invoices...");
    const openInvoices = await stripe.invoices.list({
      customer: stripeCustomerId,
      status: "open",
      limit: 5,
    });
    console.log("[getClientData] open invoices:", openInvoices.data.length);

    console.log("[getClientData] building response...");
    const response = {
      subscription: subscription
        ? subscriptionSchema.parse({
            id: subscription.id,
            status: subscription.status,
            currentPeriodStart: subscription.current_period_start,
            currentPeriodEnd: subscription.current_period_end,
            cancelAtPeriodEnd: subscription.cancel_at_period_end,
            price: subscription.items.data[0]?.price,
          })
        : null,
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

    console.log("[getClientData] response ready, returning 200");
    return new Response(JSON.stringify(response), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      },
    });
  } catch (err) {
    console.error("[getClientData] unhandled error:", err?.message ?? err);
    console.error("[getClientData] error type:", err?.constructor?.name);
    console.error("[getClientData] error stack:", err?.stack);
    return new Response(JSON.stringify({ error: "Internal server error", detail: err?.message }), {
      status: 500,
      headers: { 
        ...corsHeaders, 
        "Content-Type": "application/json" 
      },
    });
  }
}