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

    // 🔹 STEP 1: Find the most recent subscription regardless of status
    // (active, canceled, unpaid, past_due, incomplete_expired, etc.) —
    // list() with no `status` filter returns subscriptions in every state,
    // ordered by `created` descending, so `data[0]` is simply "whatever
    // subscription this customer most recently had".
    console.log("[getClientData] fetching most recent subscription (any status)...");
    const subscriptions = await stripe.subscriptions.list({
      customer: stripeCustomerId,
      limit: 1,
    });

    const subscription = subscriptions.data[0] ?? null;

    if (subscription) {
      console.log("[getClientData] subscription id:", subscription.id, "status:", subscription.status);
    } else {
      console.log("[getClientData] no subscriptions found at all for customer:", stripeCustomerId);
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

    // Not every payment goes through Stripe's Invoicing — a one-off charge
    // (e.g. paid directly via the Payment Element) never creates an Invoice
    // object, so it's invisible to invoices.list() above. Pull those in
    // separately, filtering out any charge that *is* tied to an invoice
    // (charge.invoice set) since that payment is already represented above
    // and we don't want it to show up twice.
    console.log("[getClientData] fetching standalone charges (not tied to an invoice)...");
    const charges = await stripe.charges.list({
      customer: stripeCustomerId,
      limit: 100,
    });
    const standaloneCharges = charges.data.filter((c) => !c.invoice);
    console.log(
      "[getClientData] standalone charges:",
      standaloneCharges.length,
      "of",
      charges.data.length,
      "total charges",
    );

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
      customerId: stripeCustomerId,
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
      invoices: [
        ...invoices.data.map((inv) => ({
          id: inv.id,
          status: inv.status,
          amountPaid: inv.amount_paid,
          amountDue: inv.amount_due,
          hostedInvoiceUrl: inv.hosted_invoice_url,
          invoicePdf: inv.invoice_pdf,
          created: inv.created,
        })),
        ...standaloneCharges.map((charge) => ({
          id: charge.id,
          status: charge.status === "succeeded" ? "paid" : charge.status,
          amountPaid: charge.status === "succeeded" ? charge.amount : 0,
          amountDue: charge.amount,
          hostedInvoiceUrl: charge.receipt_url,
          invoicePdf: charge.receipt_url,
          created: charge.created,
        })),
      ].sort((a, b) => b.created - a.created),
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