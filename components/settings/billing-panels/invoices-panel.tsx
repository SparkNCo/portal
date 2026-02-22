import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CreditCard, Download } from "lucide-react";

const statusColors = {
  paid: "bg-green-100 text-green-800",
  open: "bg-yellow-100 text-yellow-800",
  void: "bg-gray-100 text-gray-800",
  uncollectible: "bg-red-100 text-red-800",
};

type Invoice = {
  id: string;
  created: number;
  amountPaid: number;
  amountDue: number;
  status: string;
  invoicePdf?: string;
  currency?: string;
};
function formatDateFromUnix(seconds?: number) {
  if (!seconds) return "—";

  return new Date(seconds * 1000).toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  });
}

function formatAmountFromCents(cents?: number, currency = "usd") {
  if (cents == null) return "—";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

export function InvoicesPanel({ invoices = [] }: { invoices: Invoice[] }) {
  if (!invoices.length) {
    return (
      <CardContent>
        <p className="text-sm text-muted-foreground">No invoices yet</p>
      </CardContent>
    );
  }

  function getInvoiceAmounts(invoice: Invoice) {
    const paid = invoice.amountPaid ?? 0;
    const due = invoice.amountDue ?? 0;

    const remaining = Math.max(due - paid, 0);
    const isFullyPaid = remaining === 0 && due > 0;

    return { paid, due, remaining, isFullyPaid };
  }

  return (
    <Card className="flex flex-col space-y-2 h-full">
      {invoices.map((invoice) => (
        <div
          key={invoice.id}
          className="flex items-center justify-between rounded-lg border p-5 w-full"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
              <CreditCard className="h-5 w-5 text-muted-foreground" />
            </div>

            <div>
              <p className="text-sm font-medium">
                {formatDateFromUnix(invoice.created)}
              </p>
              {/* <p className="text-xs text-muted-foreground">
                 {invoice.id}
              </p> */}
            </div>
          </div>

          <div className="flex items-center gap-4">
            {(() => {
              const { paid, due, remaining, isFullyPaid } =
                getInvoiceAmounts(invoice);

              if (isFullyPaid) {
                return (
                  <span className="text-sm font-medium text-green-600">
                    Paid · {formatAmountFromCents(paid, invoice.currency)}
                  </span>
                );
              }

              if (remaining > 0) {
                return (
                  <span className="text-sm font-medium text-yellow-600">
                    Due · {formatAmountFromCents(remaining, invoice.currency)}
                  </span>
                );
              }

              return (
                <span className="text-sm font-medium">
                  {formatAmountFromCents(paid, invoice.currency)}
                </span>
              );
            })()}

            <Badge
              className={
                statusColors[invoice.status as keyof typeof statusColors] ??
                "bg-muted text-muted-foreground"
              }
            >
              {invoice.status}
            </Badge>

            {invoice.invoicePdf && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => window.open(invoice.invoicePdf, "_blank")}
              >
                <Download className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      ))}
    </Card>
  );
}
