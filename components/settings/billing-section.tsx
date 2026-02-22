"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { NextPaymentPanel } from "./billing-panels/next-payment-panel";
import { InvoicesPanel } from "./billing-panels/invoices-panel";
import { PendingBalancePanel } from "./billing-panels/pending-balance";
import { PaymentMethodPanel } from "./billing-panels/payment-method-expand";
import { LoadingDataPanel } from "../loader";

/* ----------------------------------
   API
-----------------------------------*/

export async function fetchBillingData() {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_ENDPOINT}/stripe/client?email=santiaguero@gmail.com`,
  );

  if (!res.ok) {
    throw new Error("Failed to fetch billing data");
  }

  return res.json();
}

/* ----------------------------------
   Helpers
-----------------------------------*/

function calculateInvoicesBalance(invoices: any[] = []) {
  let totalOutstanding = 0;
  let currency = "usd";

  invoices.forEach((inv) => {
    const due = inv.amountDue ?? 0;
    const paid = inv.amountPaid ?? 0;

    const remaining = Math.max(due - paid, 0);

    totalOutstanding += remaining;

    if (inv.currency) {
      currency = inv.currency;
    }
  });

  return {
    amount: totalOutstanding,
    currency,
    hasPendingBalance: totalOutstanding > 0,
  };
}

/* ----------------------------------
   Component
-----------------------------------*/

export function BillingSection({ billingData }: { billingData: any }) {
  const queryClient = useQueryClient();

  /* ---------------- Mutation ---------------- */

  const updatePaymentMethodMutation = useMutation({
    mutationFn: async (email: string) => {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_ENDPOINT}/stripe/create-customer-portal`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        },
      );

      if (!res.ok) {
        throw new Error("Failed to create Stripe portal session");
      }

      return res.json() as Promise<{ url: string }>;
    },
    onSuccess: (data) => {
      if (data.url) {
        window.open(data.url, "_blank");
      }
      queryClient.invalidateQueries({ queryKey: ["billing"] });
    },
    onError: (err: any) => {
      console.error("Error opening Stripe portal:", err);
    },
  });

  const handleUpdatePaymentMethod = () => {
    updatePaymentMethodMutation.mutate("santiaguero@gmail.com");
  };

  /* ---------------- Balance calc ---------------- */

  const invoices = billingData?.invoices || [];

  const balance = calculateInvoicesBalance(invoices);

  /* ---------------- UI ---------------- */

  return (
    <div className="space-y-6">
      {billingData?.subscription?.id ? (
        <div className="space-y-6">
          {/* Top panels */}
          <div className="grid gap-4 md:grid-cols-2">
            <PendingBalancePanel balance={balance} />

            <NextPaymentPanel billingData={billingData} />
          </div>

          {/* Debug */}
          <div onClick={() => console.log(billingData)}>
            VER INVOICES
          </div>

          {/* Invoices list */}
          <InvoicesPanel invoices={invoices} />

          {/* Payment method */}
          <PaymentMethodPanel
            paymentMethod={billingData?.paymentMethod}
            onUpdatePaymentMethod={handleUpdatePaymentMethod}
          />
        </div>
      ) : (
        <LoadingDataPanel />
      )}
    </div>
  );
}
