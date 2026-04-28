import { Button } from "@/components/components/ui/button";
import { LoadingDataPanel } from "@/components/loader";
import { Card, CardContent } from "@/components/ui/card";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Calendar } from "lucide-react";

/* =========================
   Types
========================= */

export interface UpcomingInvoice {
  nextPaymentAttempt?: number;
  amountDue?: number;
  currency?: string;
}

export interface Subscription {
  status?: string; // active | past_due | canceled | unpaid | trialing
}

export interface BillingData {
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

function formatDateFromUnix(seconds?: number): string {
  if (!seconds) return "—";

  return new Date(seconds * 1000).toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  });
}

function formatAmountFromCents(cents?: number, currency?: string): string {
  if (cents == null) return "—";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency?.toUpperCase() || "USD",
  }).format(cents / 100);
}

export function NextPaymentPanel({
  billingData,
  isLoading,
}: NextPaymentPanelProps) {
  if (isLoading) {
    return (
      <Card>
        <LoadingDataPanel />
      </Card>
    );
  }

  const upcomingInvoice = billingData?.upcomingInvoice;
  const subscriptionStatus = billingData?.subscription?.status;

  const isCanceled = subscriptionStatus === "canceled";
  const queryClient = useQueryClient();

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

  const handleReestablish = async () => {
    updatePaymentMethodMutation.mutate("santiaguero@gmail.com");
  };

  return (
    <Card className="bg-background">
      {/* ===============================
         Subscription Canceled State
      =============================== */}
      {isCanceled && (
        <CardContent className="pt-6 space-y-4">
          <p className="text-sm font-medium text-red-600">
            Your subscription is currently canceled.
          </p>
          <Button onClick={handleReestablish}>Renew Subscription</Button>
        </CardContent>
      )}

      {/* ===============================
         Active Subscription State
      =============================== */}
      {!isCanceled && upcomingInvoice ? (
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Next Invoice Date</p>
              <p className="text-2xl font-bold">
                {formatDateFromUnix(upcomingInvoice.nextPaymentAttempt)}
              </p>
            </div>

            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/20">
              <Calendar className="h-5 w-5 text-accent" />
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
      {!isCanceled && !upcomingInvoice && (
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">
            No upcoming invoice scheduled.
          </p>
        </CardContent>
      )}
    </Card>
  );
}
