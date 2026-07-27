"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/components/ui/button";
import { NextPaymentPanel } from "./billing-panels/next-payment-panel";
import { InvoicesPanel } from "./billing-panels/invoices-panel";
import { PendingBalancePanel } from "./billing-panels/pending-balance";
import { PaymentMethodPanel } from "./billing-panels/payment-method-expand";
import { LoadingDataPanel } from "../loader";
import { useAuth } from "../AuthContext";
import { API_HEADERS, API_JSON_HEADERS } from "@/lib/api-headers";
import { CreditCard } from "lucide-react";

export async function fetchBillingData({ user }: { user: any }) {
  const customerId = user?.stripe_customer_id ?? user?.customer_id;
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/stripe/client?customer_id=${customerId}`;
  console.log("[fetchBillingData] requesting", {
    url,
    customerId,
    headers: API_HEADERS,
  });

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

/* ---------------- Stripe Customer ID ---------------- */

function StripeIdPanel({
  stripeCustomerId,
  customerId,
  isAdmin,
  onSaved,
}: {
  stripeCustomerId?: string | null;
  customerId?: string;
  isAdmin: boolean;
  onSaved?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async (nextValue: string) => {
      if (!customerId)
        throw new Error("Missing customer record for this account");

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/users?type=customer`,
        {
          method: "PATCH",
          headers: API_JSON_HEADERS,
          body: JSON.stringify({
            customer_id: customerId,
            stripe_customer_id: nextValue,
          }),
        },
      );

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Failed to save Stripe Customer ID");
      }

      return res.json();
    },
    onSuccess: () => {
      setEditing(false);
      setError(null);
      onSaved?.();
    },
    onError: (err: any) => {
      setError(err?.message ?? "Failed to save Stripe Customer ID");
    },
  });

  const startEditing = () => {
    setValue("");
    setError(null);
    setEditing(true);
  };

  const cancelEditing = () => {
    setError(null);
    setEditing(false);
  };

  if (isAdmin && editing) {
    return (
      <Card>
        <CardContent className="bg-background flex flex-col gap-3 pt-4">
          <p className="text-sm text-foreground">Stripe Customer ID</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="cus_..."
              className="h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={mutation.isPending || !value.trim()}
                onClick={() => mutation.mutate(value)}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {mutation.isPending ? "Saving..." : "Save"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={cancelEditing}
                disabled={mutation.isPending}
              >
                Cancel
              </Button>
            </div>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </CardContent>
      </Card>
    );
  }

  if (!stripeCustomerId) {
    return (
      <Card className="bg-background">
        <CardContent className="bg-background flex flex-col gap-4 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4 ">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-secondary">
              <CreditCard className="h-6 w-6 text-foreground" />
            </div>
            <div>
              <p className="text-base font-medium text-foreground">
                No Stripe Customer ID on file
              </p>
              <p className="text-sm text-foreground/70">
                {isAdmin
                  ? "Add one below to enable billing for this account."
                  : "Contact your administrator to set up billing information."}
              </p>
            </div>
          </div>
          {isAdmin && (
            <Button
              size="sm"
              className="self-start bg-primary text-primary-foreground hover:bg-primary/90 sm:self-auto"
              onClick={startEditing}
            >
              Add Stripe ID
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  if (!isAdmin) return null;

  return (
    <Button size="sm" variant="outline" onClick={startEditing}>
      Edit Stripe Customer ID (only admins)
    </Button>
  );
}

export function BillingSection({
  billingData,
  isLoading,
  stripeCustomerId,
  customerId,
  isAdmin = false,
  onStripeIdSaved,
}: {
  billingData: any;
  isLoading: boolean;
  stripeCustomerId?: string | null;
  customerId?: string;
  isAdmin?: boolean;
  onStripeIdSaved?: () => void;
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
      <StripeIdPanel
        stripeCustomerId={stripeCustomerId}
        customerId={customerId}
        isAdmin={isAdmin}
        onSaved={onStripeIdSaved}
      />

      {!stripeCustomerId ? null : isLoading ? (
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
