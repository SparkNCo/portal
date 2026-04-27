import { Card, CardContent } from "@/components/ui/card";
import { DollarSign } from "lucide-react";
import clsx from "clsx";

/* ----------------------------------
   Types
-----------------------------------*/

type Balance = {
  amount: number; // cents
  currency: string;
  hasPendingBalance: boolean;
};

/* ----------------------------------
   Helpers
-----------------------------------*/

function formatAmountFromCents(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format((cents ?? 0) / 100);
}

/* ----------------------------------
   Component
-----------------------------------*/

export function PendingBalancePanel({ balance }: { balance?: Balance }) {
  const hasDebt = Boolean(balance?.hasPendingBalance);
  const amount = balance?.amount ?? 0;
  const currency = balance?.currency ?? "usd";

  return (
    <Card className="bg-background">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between ">
          <div>
            <p className="text-sm text-muted-foreground">Outstanding Balance</p>

            <p
              className={clsx(
                "text-2xl font-bold",
                hasDebt ? "text-warning" : "text-green-600",
              )}
            >
              {formatAmountFromCents(amount, currency)}
            </p>
          </div>

          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
            <DollarSign className="h-5 w-5 text-muted-foreground" />
          </div>
        </div>

        <p
          className={clsx(
            "mt-2 text-xs",
            hasDebt ? "text-warning" : "text-muted-foreground",
          )}
        >
          {hasDebt
            ? "Payment required to avoid service interruption"
            : "No outstanding balance"}
        </p>
      </CardContent>
    </Card>
  );
}
