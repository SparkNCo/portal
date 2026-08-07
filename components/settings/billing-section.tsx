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
import { CreditCard, ChevronUp, ChevronDown } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

/* ---------------- Billing mode (manual vs automatic) ---------------- */
// SPA-384: routed through the standalone `stripe-test` endpoint rather than
// `users?type=customer`, to keep this in-progress toggle isolated from the
// already-deployed `users` function.

function BillingModeToggle({
  customerId,
  billingMode,
  onSaved,
}: {
  customerId?: string;
  billingMode: "automatic" | "manual";
  onSaved?: () => void;
}) {
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async (nextMode: "automatic" | "manual") => {
      if (!customerId)
        throw new Error("Missing customer record for this account");

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/stripe-test`,
        {
          method: "PATCH",
          headers: API_JSON_HEADERS,
          body: JSON.stringify({
            customer_id: customerId,
            billing_mode: nextMode,
          }),
        },
      );

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Failed to save billing mode");
      }

      return res.json();
    },
    onSuccess: () => {
      setError(null);
      onSaved?.();
    },
    onError: (err: any) => {
      setError(err?.message ?? "Failed to save billing mode");
    },
  });

  const nextMode = billingMode === "automatic" ? "manual" : "automatic";
  const nextModeLabel = nextMode === "automatic" ? "Automatic" : "Manual";

  return (
    <Card>
      <CardContent className="bg-background flex flex-col gap-3 pt-4">
        <div className="flex flex-col gap-1">
          <p className="text-sm text-foreground">Invoicing</p>
          <p className="text-xs text-foreground/70">
            Automatic charges this client through Stripe. Manual hides the
            Stripe billing dashboard — invoice this client outside the portal.
          </p>
        </div>
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-foreground">
            Current mode:{" "}
            <span className="font-medium text-primary capitalize">
              {billingMode}
            </span>
          </p>
          <Button
            size="sm"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate(nextMode)}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {mutation.isPending ? "Saving..." : `Change mode to ${nextModeLabel}`}
          </Button>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}

/* ---------------- Invoice amount & frequency (automatic only) ---------------- */
// SPA-384: same isolated `stripe-test` endpoint as the billing mode toggle.

const INTERVAL_OPTIONS: { value: "day" | "week" | "month" | "year"; label: string }[] = [
  { value: "day", label: "day(s)" },
  { value: "week", label: "week(s)" },
  { value: "month", label: "month(s)" },
  { value: "year", label: "year(s)" },
];

function describeInvoiceSchedule(
  amount: number | null,
  interval: "day" | "week" | "month" | "year" | null,
  intervalCount: number | null,
) {
  if (amount == null || !interval) return "Not set yet";
  const count = intervalCount ?? 1;
  const unit = count === 1 ? interval : `${interval}s`;
  const cadence = count === 1 ? `every ${unit}` : `every ${count} ${unit}`;
  return `$${amount.toFixed(2)} ${cadence}`;
}

function NumberStepper({
  value,
  onChange,
  onBump,
  step,
  min,
  autoFocus,
  placeholder,
  className,
  leadingSlot,
}: {
  value: string;
  onChange: (value: string) => void;
  onBump: (delta: number) => void;
  step: number;
  min: number;
  autoFocus?: boolean;
  placeholder?: string;
  className?: string;
  leadingSlot?: React.ReactNode;
}) {
  return (
    <div
      className={
        "flex h-9 items-stretch overflow-hidden rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring" +
        (className ? ` ${className}` : "")
      }
    >
      {leadingSlot}
      <input
        autoFocus={autoFocus}
        type="number"
        min={min}
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full min-w-0 bg-transparent pl-2 text-sm focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <div className="flex flex-col border-l border-input">
        <button
          type="button"
          tabIndex={-1}
          onClick={() => onBump(step)}
          className="flex flex-1 items-center justify-center px-1 text-muted-foreground transition-colors hover:bg-accent/10 hover:text-foreground"
        >
          <ChevronUp className="h-3 w-3" />
        </button>
        <button
          type="button"
          tabIndex={-1}
          onClick={() => onBump(-step)}
          className="flex flex-1 items-center justify-center border-t border-input px-1 text-muted-foreground transition-colors hover:bg-accent/10 hover:text-foreground"
        >
          <ChevronDown className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

function InvoiceSettingsPanel({
  customerId,
  invoiceAmount,
  invoiceInterval,
  invoiceIntervalCount,
  onSaved,
}: {
  customerId?: string;
  invoiceAmount: number | null;
  invoiceInterval: "day" | "week" | "month" | "year" | null;
  invoiceIntervalCount: number | null;
  onSaved?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState("");
  const [interval, setInterval] = useState<"day" | "week" | "month" | "year">("month");
  const [intervalCount, setIntervalCount] = useState("1");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const bumpIntervalCount = (delta: number) => {
    const next = Math.max(1, (Number.parseInt(intervalCount, 10) || 1) + delta);
    setIntervalCount(String(next));
  };

  const bumpAmount = (delta: number) => {
    const next = Math.max(0, (Number.parseFloat(amount) || 0) + delta);
    setAmount(next.toFixed(2));
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (!customerId)
        throw new Error("Missing customer record for this account");

      const amountNum = Number(amount);
      if (!Number.isFinite(amountNum) || amountNum <= 0) {
        throw new Error("Enter a valid amount");
      }
      const countNum = Number(intervalCount);
      if (!Number.isInteger(countNum) || countNum <= 0) {
        throw new Error("Enter a valid frequency");
      }

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/stripe-test`,
        {
          method: "PATCH",
          headers: API_JSON_HEADERS,
          body: JSON.stringify({
            customer_id: customerId,
            invoice_amount: amountNum,
            invoice_interval: interval,
            invoice_interval_count: countNum,
          }),
        },
      );

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Failed to save invoice settings");
      }

      return res.json() as Promise<{ priceSync?: { applied: boolean } }>;
    },
    onSuccess: (data) => {
      setEditing(false);
      setError(null);
      setNotice(
        data?.priceSync?.applied
          ? null
          : "Saved, but this client has no active Stripe subscription yet — nothing is being charged until one exists.",
      );
      onSaved?.();
    },
    onError: (err: any) => {
      setError(err?.message ?? "Failed to save invoice settings");
    },
  });

  const startEditing = () => {
    setAmount(invoiceAmount != null ? String(invoiceAmount) : "");
    setInterval(invoiceInterval ?? "month");
    setIntervalCount(String(invoiceIntervalCount ?? 1));
    setError(null);
    setNotice(null);
    setEditing(true);
  };

  const cancelEditing = () => {
    setError(null);
    setEditing(false);
  };

  if (editing) {
    return (
      <Card>
        <CardContent className="bg-background flex flex-col gap-3 pt-4">
          <p className="text-sm text-foreground">Invoice amount &amp; frequency</p>
          <div className="flex flex-wrap items-center gap-2">
            <NumberStepper
              autoFocus
              min={0}
              step={0.01}
              value={amount}
              onChange={setAmount}
              onBump={bumpAmount}
              placeholder="0.00"
              className="w-28"
              leadingSlot={
                <span className="flex items-center pl-2 text-sm text-foreground/70">
                  $
                </span>
              }
            />
            <span className="text-sm text-foreground/70">every</span>
            <NumberStepper
              min={1}
              step={1}
              value={intervalCount}
              onChange={setIntervalCount}
              onBump={bumpIntervalCount}
              className="w-16"
            />
            <Select
              value={interval}
              onValueChange={(v) => setInterval(v as "day" | "week" | "month" | "year")}
            >
              <SelectTrigger className="h-9 w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INTERVAL_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={mutation.isPending || !amount.trim()}
              onClick={() => mutation.mutate()}
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
          {error && <p className="text-xs text-destructive">{error}</p>}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="bg-background flex flex-col gap-2 pt-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-foreground">Invoice amount &amp; frequency</p>
            <p className="text-xs text-foreground/70">
              {describeInvoiceSchedule(invoiceAmount, invoiceInterval, invoiceIntervalCount)}
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={startEditing}>
            Edit
          </Button>
        </div>
        {notice && <p className="text-xs text-amber-500">{notice}</p>}
      </CardContent>
    </Card>
  );
}

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
  billingMode = "automatic",
  invoiceAmount = null,
  invoiceInterval = null,
  invoiceIntervalCount = null,
  isAdmin = false,
  onStripeIdSaved,
  onBillingModeSaved,
  onInvoiceSettingsSaved,
}: {
  billingData: any;
  isLoading: boolean;
  stripeCustomerId?: string | null;
  customerId?: string;
  billingMode?: "automatic" | "manual";
  invoiceAmount?: number | null;
  invoiceInterval?: "day" | "week" | "month" | "year" | null;
  invoiceIntervalCount?: number | null;
  isAdmin?: boolean;
  onStripeIdSaved?: () => void;
  onBillingModeSaved?: () => void;
  onInvoiceSettingsSaved?: () => void;
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

  const isManual = billingMode === "manual";

  let billingContent: React.ReactNode = null;
  if (stripeCustomerId) {
    if (isManual) {
      billingContent = (
        <Card className="bg-background">
          <CardContent className="bg-background flex items-center gap-4 pt-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-secondary">
              <CreditCard className="h-6 w-6 text-foreground" />
            </div>
            <div>
              <p className="text-base font-medium text-foreground">
                This client is invoiced manually
              </p>
              <p className="text-sm text-foreground/70">
                Billing details, invoices, and payment methods are handled
                outside the portal.
              </p>
            </div>
          </CardContent>
        </Card>
      );
    } else if (isLoading) {
      billingContent = <LoadingDataPanel />;
    } else {
      billingContent = (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <PendingBalancePanel balance={balance} />
            <NextPaymentPanel billingData={billingData} isLoading={isLoading} />{" "}
          </div>
          <InvoicesPanel invoices={invoices} />
          <PaymentMethodPanel
            paymentMethod={billingData?.paymentMethod}
            onUpdatePaymentMethod={handleUpdatePaymentMethod}
          />
        </div>
      );
    }
  }

  return (
    <div className="space-y-6">
      <StripeIdPanel
        stripeCustomerId={stripeCustomerId}
        customerId={customerId}
        isAdmin={isAdmin}
        onSaved={onStripeIdSaved}
      />

      {stripeCustomerId && isAdmin && (
        <BillingModeToggle
          customerId={customerId}
          billingMode={billingMode}
          onSaved={onBillingModeSaved}
        />
      )}

      {stripeCustomerId && isAdmin && !isManual && (
        <InvoiceSettingsPanel
          customerId={customerId}
          invoiceAmount={invoiceAmount}
          invoiceInterval={invoiceInterval}
          invoiceIntervalCount={invoiceIntervalCount}
          onSaved={onInvoiceSettingsSaved}
        />
      )}

      {billingContent}
    </div>
  );
}
