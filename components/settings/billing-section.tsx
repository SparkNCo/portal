"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { NextPaymentPanel } from "./billing-panels/next-payment-panel";
import { InvoicesPanel } from "./billing-panels/invoices-panel";
import { PendingBalancePanel } from "./billing-panels/pending-balance";
import { PaymentMethodPanel } from "./billing-panels/payment-method-expand";
import { LoadingDataPanel } from "../loader";
import { useAuth } from "../AuthContext";

export async function fetchBillingData({ user }: { user: any }) {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_ENDPOINT}/stripe/client?customer_id=${user?.customer_id}`,
  );

  if (!res.ok) {
    throw new Error("Failed to fetch billing data");
  }

  return res.json();
}

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

export function BillingSection({
  billingData,
  isLoading,
}: {
  billingData: any;
  isLoading: boolean;
}) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

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
  });

  const handleUpdatePaymentMethod = () => {
    updatePaymentMethodMutation.mutate(`${user?.email}`);
  };

  /* ---------------- Balance calc ---------------- */

  const invoices = billingData?.invoices || [];

  const balance = calculateInvoicesBalance(invoices);

  /* ---------------- UI ---------------- */

  return (
    <div className="space-y-6">
      {billingData?.subscription?.id ? (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <PendingBalancePanel balance={balance} />
            <NextPaymentPanel
              billingData={billingData}
              isLoading={isLoading}
            />{" "}
          </div>
          <InvoicesPanel invoices={invoices} />
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
