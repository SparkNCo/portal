import { LoadingDataPanel } from "@/components/loader";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar } from "lucide-react";

function formatDateFromUnix(seconds?: number) {
  if (!seconds) return "—";

  return new Date(seconds * 1000).toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  });
}

function formatAmountFromCents(cents?: number, currency?: string) {
  if (cents == null) return "—";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency?.toUpperCase() || "USD",
  }).format(cents / 100);
}

export function NextPaymentPanel({ billingData }) {
  return (
    <Card>
      {billingData?.upcomingInvoice ? (
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Next Invoice Date</p>
              <p className="text-2xl font-bold">
                {formatDateFromUnix(
                  billingData.upcomingInvoice.nextPaymentAttempt,
                )}
              </p>
            </div>

            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/20">
              <Calendar className="h-5 w-5 text-accent" />
            </div>
          </div>

          <p className="text-xs text-muted-foreground mt-2">
            {formatAmountFromCents(
              billingData.upcomingInvoice.amountDue,
              billingData.upcomingInvoice.currency,
            )}{" "}
            estimated
          </p>
        </CardContent>
      ) : (
        <LoadingDataPanel />
      )}
    </Card>
  );
}
