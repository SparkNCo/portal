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
import { CreditCard, ChevronUp, ChevronDown, Pencil } from "lucide-react";
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
// SPA-384: routed through the standalone `stripe-edit` endpoint rather than
// `users?type=customer`, to keep this in-progress toggle isolated from the
// already-deployed `users` function.

function BillingModeFields({
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
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/stripe-edit`,
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
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <p className="smalltext text-card">Invoicing</p>
        <p className="smalltext text-foreground/70">
          Automatic charges this client through Stripe. Manual hides the
          Stripe billing dashboard — invoice this client outside the portal.
        </p>
      </div>
      <div className="flex items-center justify-between gap-2">
        <p className="smalltext text-foreground">
          Current mode:{" "}
          <span className="font-medium text-primary capitalize">
            {billingMode}
          </span>
        </p>
        <Button
          size="sm"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate(nextMode)}
          className="bg-primary text-primary-foreground hover:bg-primary/90 smalltext"
        >
          {mutation.isPending ? "Saving..." : `Change mode to ${nextModeLabel}`}
        </Button>
      </div>
      {error && <p className="smalltext text-destructive">{error}</p>}
    </div>
  );
}

/* ---------------- Invoice amount & frequency (automatic only) ---------------- */
// SPA-384: same isolated `stripe-edit` endpoint as the billing mode toggle.

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
        className="w-full min-w-0 bg-transparent pl-2 smalltext focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
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

function InvoiceSettingsFields({
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
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/stripe-edit`,
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
      <div className="flex flex-col gap-3">
        <p className="smalltext text-foreground">Invoice amount &amp; frequency</p>
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
              <span className="flex items-center pl-2 smalltext text-foreground/70">
                $
              </span>
            }
          />
          <span className="smalltext text-foreground/70">every</span>
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
            <SelectTrigger className="h-9 w-28 smalltext">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INTERVAL_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} className="smalltext">
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
            className="bg-primary text-primary-foreground hover:bg-primary/90 smalltext"
          >
            {mutation.isPending ? "Saving..." : "Save"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={cancelEditing}
            disabled={mutation.isPending}
            className="smalltext"
          >
            Cancel
          </Button>
        </div>
        {error && <p className="smalltext text-destructive">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div>
        <p className="smalltext text-card flex items-center gap-1.5">
          Invoice amount &amp; frequency
          <Button
            size="icon"
            variant="ghost"
            onClick={startEditing}
            className="h-6 w-6 flex-shrink-0 text-card/70 hover:text-card"
            aria-label="Edit invoice amount & frequency"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        </p>
        <p className="smalltext text-foreground/70">
          {describeInvoiceSchedule(invoiceAmount, invoiceInterval, invoiceIntervalCount)}
        </p>
      </div>
      {notice && <p className="smalltext text-amber-500">{notice}</p>}
    </div>
  );
}

function StripeIdPanel({
  stripeCustomerId,
  isAdmin,
}: {
  stripeCustomerId?: string | null;
  isAdmin: boolean;
}) {
  // Admins manage the Stripe Customer ID from the merged admin billing
  // controls panel instead (see StripeIdField below), which handles both the
  // missing-ID and existing-ID states — this component only needs to explain
  // the missing-ID state to non-admins, who have no way to act on it.
  if (isAdmin || stripeCustomerId) return null;

  return (
    <Card className="bg-transparent text-foreground">
      <CardContent className="bg-background flex items-center gap-4 pt-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-secondary">
          <CreditCard className="h-6 w-6 text-foreground" />
        </div>
        <div>
          <p className="smalltext font-medium text-foreground">
            No Stripe Customer ID on file
          </p>
          <p className="smalltext text-foreground/70">
            Contact your administrator to set up billing information.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// Stripe customer IDs are always "cus_" followed by an alphanumeric string
// (Stripe has changed the exact length before, so this only checks the
// shape, not a fixed length) — catches pasting the wrong kind of Stripe ID
// (e.g. a subscription "sub_..." or price "price_...") or a stray typo
// before it's saved.
const STRIPE_CUSTOMER_ID_RE = /^cus_[A-Za-z0-9]+$/;

// Admin-only fields (Stripe Customer ID, invoicing mode, invoice amount &
// frequency) merged into one panel — all three only ever show for admins and
// only once a Stripe Customer ID is on file, so three stacked cards were
// really one settings group.
function StripeIdField({
  customerId,
  stripeCustomerId,
  onSaved,
}: {
  customerId?: string;
  stripeCustomerId?: string | null;
  onSaved?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async (nextValue: string) => {
      if (!customerId)
        throw new Error("Missing customer record for this account");

      const trimmed = nextValue.trim();
      if (!STRIPE_CUSTOMER_ID_RE.test(trimmed)) {
        throw new Error("Enter a valid Stripe Customer ID (starts with cus_)");
      }

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/users?type=customer`,
        {
          method: "PATCH",
          headers: API_JSON_HEADERS,
          body: JSON.stringify({
            customer_id: customerId,
            stripe_customer_id: trimmed,
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

  if (editing) {
    return (
      <div className="flex flex-col gap-3">
        <div>
          <p className="smalltext text-foreground">Stripe Customer ID</p>
          {!stripeCustomerId && (
            <p className="smalltext text-foreground/70">
              This customer doesn&apos;t have a customer id yet.
            </p>
          )}
        </div>
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="cus_..."
          className="h-9 w-full max-w-[28rem] rounded-md border border-input bg-background px-3 smalltext focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <div className="flex gap-2">
          <Button
            size="sm"
            disabled={mutation.isPending || !STRIPE_CUSTOMER_ID_RE.test(value.trim())}
            onClick={() => mutation.mutate(value)}
            className="bg-primary text-primary-foreground hover:bg-primary/90 smalltext"
          >
            {mutation.isPending ? "Saving..." : "Save"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={cancelEditing}
            disabled={mutation.isPending}
            className="smalltext"
          >
            Cancel
          </Button>
        </div>
        {value.trim() && !STRIPE_CUSTOMER_ID_RE.test(value.trim()) && (
          <p className="smalltext text-destructive">
            Must start with cus_ followed by letters/numbers
          </p>
        )}
        {error && <p className="smalltext text-destructive">{error}</p>}
      </div>
    );
  }

  // Same shape as InvoiceSettingsFields' summary row below — pencil icon
  // next to the title, current value (or lack thereof) underneath — so the
  // two admin fields read as one consistent format.
  return (
    <div>
      <p className="smalltext text-card flex items-center gap-1.5">
        Stripe Customer ID
        <Button
          size="icon"
          variant="ghost"
          onClick={startEditing}
          className="h-6 w-6 flex-shrink-0 text-card/70 hover:text-card"
          aria-label={stripeCustomerId ? "Edit Stripe Customer ID" : "Add Stripe Customer ID"}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      </p>
      <p className="smalltext text-foreground/70">
        {stripeCustomerId ?? "This customer doesn't have a customer id yet."}
      </p>
    </div>
  );
}

function AdminBillingControls({
  customerId,
  stripeCustomerId,
  billingMode,
  invoiceAmount,
  invoiceInterval,
  invoiceIntervalCount,
  onStripeIdSaved,
  onBillingModeSaved,
  onInvoiceSettingsSaved,
}: {
  customerId?: string;
  stripeCustomerId?: string | null;
  billingMode?: "automatic" | "manual";
  invoiceAmount: number | null;
  invoiceInterval: "day" | "week" | "month" | "year" | null;
  invoiceIntervalCount: number | null;
  onStripeIdSaved?: () => void;
  onBillingModeSaved?: () => void;
  onInvoiceSettingsSaved?: () => void;
}) {
  const isManual = billingMode === "manual";
  // Invoicing mode and invoice amount/frequency only make sense once a
  // Stripe Customer ID actually exists — the ID field itself always shows,
  // handling both the missing- and existing-ID states on its own.
  const hasStripeId = !!stripeCustomerId;
  // billingMode is undefined while its own query is still loading/erroring
  // (see BillingSection) — BillingModeFields needs a real current mode to
  // compute what "switch to X" even means, so hold it back until known
  // rather than showing a toggle that might be wrong.

  return (
    <Card className="bg-transparent text-foreground">
      <CardContent
        className={`bg-background flex flex-col pt-4 ${hasStripeId ? "divide-y divide-border" : ""}`}
      >
        <div className={hasStripeId ? "pb-4" : ""}>
          <StripeIdField
            customerId={customerId}
            stripeCustomerId={stripeCustomerId}
            onSaved={onStripeIdSaved}
          />
        </div>
        {hasStripeId && billingMode && (
          <>
            <div className="py-4">
              <BillingModeFields
                customerId={customerId}
                billingMode={billingMode}
                onSaved={onBillingModeSaved}
              />
            </div>
            {!isManual && (
              <div className="pt-4">
                <InvoiceSettingsFields
                  customerId={customerId}
                  invoiceAmount={invoiceAmount}
                  invoiceInterval={invoiceInterval}
                  invoiceIntervalCount={invoiceIntervalCount}
                  onSaved={onInvoiceSettingsSaved}
                />
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function BillingSection({
  billingData,
  isLoading,
  stripeCustomerId,
  customerId,
  billingMode,
  isBillingModeLoading = false,
  isBillingModeError = false,
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
  // Undefined (rather than defaulting to "automatic") means the billing-mode
  // query hasn't resolved yet — see isBillingModeLoading/isBillingModeError.
  billingMode?: "automatic" | "manual";
  isBillingModeLoading?: boolean;
  isBillingModeError?: boolean;
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
    if (isBillingModeLoading || isBillingModeError) {
      // Don't guess: showing the Stripe panels (or the "manual" message)
      // before we actually know the mode risks firing Stripe requests for a
      // manually-invoiced client, or briefly claiming a client is manual
      // when they're not.
      billingContent = (
        <Card className="bg-transparent text-foreground">
          <CardContent className="bg-background flex items-center gap-4 pt-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-secondary">
              <CreditCard className="h-6 w-6 text-foreground" />
            </div>
            <div>
              <p className="text-base font-medium text-foreground">
                {isBillingModeError ? "Couldn't check billing mode" : "Checking billing mode…"}
              </p>
              <p className="smalltext text-foreground/70">
                {isBillingModeError
                  ? "Try refreshing the page — billing details will show once we know how this client is invoiced."
                  : "Billing details will show once we confirm how this client is invoiced."}
              </p>
            </div>
          </CardContent>
        </Card>
      );
    } else if (isManual) {
      billingContent = (
        <Card className="bg-transparent text-foreground">
          <CardContent className="bg-background flex items-center gap-4 pt-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-secondary">
              <CreditCard className="h-6 w-6 text-foreground" />
            </div>
            <div>
              <p className="text-base font-medium text-foreground">
                This client is invoiced manually
              </p>
              <p className="smalltext text-foreground/70">
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
            canUpdate={!isAdmin}
          />
        </div>
      );
    }
  }

  return (
    <div className="space-y-6">
      <StripeIdPanel stripeCustomerId={stripeCustomerId} isAdmin={isAdmin} />

      {isAdmin && (
        <AdminBillingControls
          customerId={customerId}
          stripeCustomerId={stripeCustomerId}
          billingMode={billingMode}
          invoiceAmount={invoiceAmount}
          invoiceInterval={invoiceInterval}
          invoiceIntervalCount={invoiceIntervalCount}
          onStripeIdSaved={onStripeIdSaved}
          onBillingModeSaved={onBillingModeSaved}
          onInvoiceSettingsSaved={onInvoiceSettingsSaved}
        />
      )}

      {billingContent}
    </div>
  );
}
