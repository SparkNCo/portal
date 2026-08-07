import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CreditCard, Download } from "lucide-react";
import { formatDateFromUnix, formatAmountFromCents } from "@/lib/formatters";

const statusColors = {
  paid: "bg-green-100 text-green-800",
  open: "bg-yellow-100 text-yellow-800",
  void: "bg-gray-100 text-gray-800",
  uncollectible: "bg-red-100 text-red-800",
  failed: "bg-red-100 text-red-800",
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

export function InvoicesPanel({ invoices = [] }: { invoices: Invoice[] }) {
  const [showAll, setShowAll] = useState(false);

  if (!invoices.length) {
    return (
      <CardContent>
        <p className="text-sm text-muted-foreground">No invoices yet</p>
      </CardContent>
    );
  }

  const visible = showAll ? invoices : invoices.slice(0, 5);

  function getInvoiceAmounts(invoice: Invoice) {
    const paid = invoice.amountPaid ?? 0;
    const due = invoice.amountDue ?? 0;

    const remaining = Math.max(due - paid, 0);
    const isFullyPaid = remaining === 0 && due > 0;

    return { paid, due, remaining, isFullyPaid };
  }

  return (
    <Card className="flex flex-col space-y-2 h-full bg-transparent text-foreground">
      {visible.map((invoice) => (
        <div
          key={invoice.id}
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg border border-transparent bg-background hover:bg-muted transition-colors p-4 w-full"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <CreditCard className="h-4 w-4 text-primary" />
            </div>
            <p className="text-sm font-medium text-foreground">
              {formatDateFromUnix(invoice.created)}
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
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
                <span className="text-sm font-medium text-foreground">
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
                className="hover:text-primary"
                onClick={() => window.open(invoice.invoicePdf, "_blank")}
                aria-label={`Download invoice from ${formatDateFromUnix(invoice.created)}`}
              >
                <Download className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      ))}
      {invoices.length > 5 && (
        <div className="flex justify-center pt-1 pb-2">
          <Button variant="ghost" size="sm" onClick={() => setShowAll((v) => !v)}>
            {showAll ? "Show less" : `Show all ${invoices.length} invoices`}
          </Button>
        </div>
      )}
    </Card>
  );
}
