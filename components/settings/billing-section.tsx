"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { NextPaymentPanel } from "./billing-panels/next-payment-panel";
import { InvoicesPanel } from "./billing-panels/invoices-panel";
import { PendingBalancePanel } from "./billing-panels/pending-balance";
import { PaymentMethodPanel } from "./billing-panels/payment-method-expand";
import { LoadingDataPanel } from "../loader";
import { useAuth } from "../AuthContext";
import { API_HEADERS, API_JSON_HEADERS } from "@/lib/api-headers";

export async function fetchBillingData({ user }: { user: any }) {
  const customerId = user?.stripe_customer_id ?? user?.customer_id;
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/stripe/client?customer_id=${customerId}`;
  console.log("[fetchBillingData] requesting", { url, customerId, headers: API_HEADERS });

  const res = await fetch(url, { headers: API_HEADERS });

  console.log("[fetchBillingData] response status", res.status, res.ok);

  if (!res.ok) {
    const body = await res.text().catch(() => "<unreadable body>");
    console.error("[fetchBillingData] failed response body:", body);
    throw new Error("Failed to fetch billing data");
  }

  const data = await res.json();
  console.log("[fetchBillingData] success", data);
  return data;
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
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/stripe/create-customer-portal`,
        {
          method: "POST",
          headers: API_JSON_HEADERS,
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
      {isLoading ? (
        <LoadingDataPanel />
      ) : (
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
      )}
    </div>
  );
}
