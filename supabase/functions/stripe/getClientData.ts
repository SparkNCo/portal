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
    const { customer_id } = parseResult.data;
    console.log("[getClientData] validated customer_id:", customer_id);

    // 🔹 STEP 1: Find active subscription from Stripe
    const subscriptions = await stripe.subscriptions.list({
      customer: customer_id,
      status: "active",
      limit: 1,
    });

    console.log("[getClientData] subscriptions found:", subscriptions.data.length);

    if (!subscriptions.data.length) {
      console.log("[getClientData] no active subscription for customer:", customer_id);
      return new Response(
        JSON.stringify({ error: "No active subscription found for this customer" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    const subscription = subscriptions.data[0];

    let upcomingInvoice = null;
    try {
      upcomingInvoice = await stripe.invoices.retrieveUpcoming({
        customer: customer_id,
        subscription: subscription.id,
      });
    } catch {
      upcomingInvoice = null;
    }

    const invoices = await stripe.invoices.list({
      customer: customer_id,
      limit: 100,
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