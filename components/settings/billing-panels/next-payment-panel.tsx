import { useState } from "react";
import { Button } from "@/components/components/ui/button";
import { LoadingDataPanel } from "@/components/loader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Calendar, Loader2 } from "lucide-react";
import { formatDateFromUnix, formatAmountFromCents } from "@/lib/formatters";
import { API_JSON_HEADERS } from "@/lib/api-headers";

// Statuses where the subscription is no longer collecting payment and the
// customer needs to start a new one — not just "canceled": a subscription
// that dies from repeated failed payments ends up "unpaid" or
// "incomplete_expired" instead, and those need the same renew CTA.
const NEEDS_RENEWAL_STATUSES = new Set(["canceled", "unpaid", "incomplete_expired"]);

const SUBSCRIPTION_STATUS_COLORS: Record<string, string> = {
  active: "bg-success/20 text-success border-success/30",
  trialing: "bg-blue-500/20 text-blue-600 border-blue-500/30",
  past_due: "bg-warning/20 text-warning border-warning/30",
  incomplete: "bg-warning/20 text-warning border-warning/30",
  paused: "bg-muted text-muted-foreground border-muted",
  canceled: "bg-destructive/20 text-destructive border-destructive/30",
  unpaid: "bg-destructive/20 text-destructive border-destructive/30",
  incomplete_expired: "bg-destructive/20 text-destructive border-destructive/30",
};

function formatStatusLabel(status: string) {
  return status
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/* =========================
   Types
========================= */

export interface UpcomingInvoice {
  nextPaymentAttempt?: number;
  amountDue?: number;
  currency?: string;
}

export interface Subscription {
  id?: string;
  status?: string; // active | past_due | canceled | unpaid | trialing
}

export interface BillingData {
  customerId?: string | null;
  upcomingInvoice?: UpcomingInvoice | null;
  subscription?: Subscription | null;
}

export interface NextPaymentPanelProps {
  billingData?: BillingData | null;
  isLoading: boolean;
}

/* =========================
   Helpers
========================= */


export function NextPaymentPanel({
  billingData,
  isLoading,
}: NextPaymentPanelProps) {
  const queryClient = useQueryClient();
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const renewSubscriptionMutation = useMutation({
    mutationFn: async (customerId: string) => {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/stripe/renew-subscription`,
        {
          method: "POST",
          headers: API_JSON_HEADERS,
          body: JSON.stringify({ customer_id: customerId }),
        },
      );

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? "Failed to renew subscription");
      }

      return data as { id: string; status: string };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["billing"] });
    },
  });

  const cancelSubscriptionMutation = useMutation({
    mutationFn: async (subscriptionId: string) => {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/stripe/cancel-subscription`,
        {
          method: "POST",
          headers: API_JSON_HEADERS,
          body: JSON.stringify({ subscription_id: subscriptionId }),
        },
      );
      console.log("hola");

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? "Failed to cancel subscription");
      }

      return data as { id: string; status: string };
    },
    onSuccess: () => {
      setShowCancelConfirm(false);
      queryClient.invalidateQueries({ queryKey: ["billing"] });
    },
  });

  if (isLoading) {
    return (
      <Card className="bg-transparent">
        <LoadingDataPanel />
      </Card>
    );
  }

  const upcomingInvoice = billingData?.upcomingInvoice;
  const subscriptionStatus = billingData?.subscription?.status;

  // No subscription at all (never had one) counts the same as one that died —
  // both need a brand-new subscription created, so they share the renew CTA.
  const needsRenewal = !subscriptionStatus || NEEDS_RENEWAL_STATUSES.has(subscriptionStatus);
  const statusLabel = subscriptionStatus ? formatStatusLabel(subscriptionStatus) : "";

  const handleRenew = () => {
    if (billingData?.customerId) renewSubscriptionMutation.mutate(billingData.customerId);
  };

  const handleConfirmCancel = () => {
    const subscriptionId = billingData?.subscription?.id;
    if (!subscriptionId) return;
    cancelSubscriptionMutation.mutate(subscriptionId);
  };

  return (
    <Card className="bg-transparent text-foreground">
      {subscriptionStatus && (
        <div className="flex items-center justify-between px-6 pt-4">
          <span className="text-xs text-muted-foreground">Subscription status</span>
          <Badge
            variant="outline"
            className={SUBSCRIPTION_STATUS_COLORS[subscriptionStatus] ?? "bg-muted text-muted-foreground"}
          >
            {statusLabel}
          </Badge>
        </div>
      )}

      {!needsRenewal && subscriptionStatus && (
        <div className="px-6 pt-2">
          <Button
            variant="ghost"
            size="sm"
            className="bg-primary text-black hover:bg-primary/90"
            onClick={() => setShowCancelConfirm(true)}
            disabled={!billingData?.subscription?.id}
          >
            Cancel Subscription
          </Button>
        </div>
      )}

      {/* ===============================
         Needs Renewal (canceled / unpaid / incomplete_expired)
      =============================== */}
      {needsRenewal && (
        <CardContent className="pt-4 space-y-4">
          <p className="text-sm font-medium text-red-600">
            {subscriptionStatus
              ? `Your subscription is currently ${statusLabel.toLowerCase()}.`
              : "You don't have an active subscription."}
          </p>
          <Button
            onClick={handleRenew}
            disabled={!billingData?.customerId || renewSubscriptionMutation.isPending}
          >
            {renewSubscriptionMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Renewing…
              </>
            ) : (
              "Renew Subscription"
            )}
          </Button>
          {renewSubscriptionMutation.isError && (
            <p className="text-xs text-red-600">
              {renewSubscriptionMutation.error?.message}
            </p>
          )}
        </CardContent>
      )}

      {/* ===============================
         Active Subscription State
      =============================== */}
      {!needsRenewal && upcomingInvoice ? (
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Next Invoice Date</p>
              <p className="text-2xl font-bold">
                {formatDateFromUnix(upcomingInvoice.nextPaymentAttempt)}
              </p>
            </div>

            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Calendar className="h-5 w-5 text-primary" />
            </div>
          </div>

          <p className="text-xs text-muted-foreground mt-2">
            {formatAmountFromCents(
              upcomingInvoice.amountDue,
              upcomingInvoice.currency,
            )}{" "}
            estimated
          </p>
        </CardContent>
      ) : null}

      {/* ===============================
         No Upcoming Invoice (Active but none)
      =============================== */}
      {!needsRenewal && !upcomingInvoice && (
        <CardContent className="pt-4">
          <p className="text-sm text-muted-foreground">
            No upcoming invoice scheduled.
          </p>
        </CardContent>
      )}

      <Dialog open={showCancelConfirm} onOpenChange={setShowCancelConfirm}>
        <DialogContent className="border-primary">
          <DialogHeader>
            <DialogTitle>Cancel subscription?</DialogTitle>
            <DialogDescription>
              This takes effect immediately — billing stops right away, not at the
              end of the current period. This can't be undone from here.
            </DialogDescription>
          </DialogHeader>

          {cancelSubscriptionMutation.isError && (
            <p className="text-sm text-red-600">
              {cancelSubscriptionMutation.error?.message}
            </p>
          )}

          <DialogFooter>
            <Button
              className="bg-primary text-black hover:bg-primary hover:text-black"
              onClick={() => setShowCancelConfirm(false)}
              disabled={cancelSubscriptionMutation.isPending}
            >
              Keep Subscription
            </Button>
            <Button
              variant="outline"
              className="hover:bg-background hover:text-foreground"
              onClick={handleConfirmCancel}
              disabled={cancelSubscriptionMutation.isPending}
            >
              {cancelSubscriptionMutation.isPending ? "Canceling…" : "Cancel Subscription"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
