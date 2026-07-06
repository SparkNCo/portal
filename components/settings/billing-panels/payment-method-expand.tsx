import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/components/ui/button";
import { CreditCard } from "lucide-react";

type PaymentMethod = {
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
};

export function PaymentMethodPanel({
  paymentMethod,
  onUpdatePaymentMethod,
}: {
  paymentMethod?: PaymentMethod | null;
  onUpdatePaymentMethod?: () => void;
}) {
  if (!paymentMethod) {
    return (
      <Card>
        <CardContent className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-4">
          <div>
            <p className="text-sm text-muted-foreground">Payment Method</p>
            <p className="text-base font-medium text-muted-foreground">
              No payment method added
            </p>
          </div>
          <Button
            size="sm"
            className="self-start sm:self-auto bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={onUpdatePaymentMethod}
          >
            Add Card
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-background">
      <CardContent className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-4">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-muted">
            <CreditCard className="h-6 w-6 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Payment Method</p>
            <p className="text-lg font-semibold">
              {paymentMethod.brand.toUpperCase()} ****{paymentMethod.last4}
            </p>
            <p className="text-sm text-muted-foreground">
              Expires {paymentMethod.expMonth}/{paymentMethod.expYear}
            </p>
          </div>
        </div>
        <Button
          size="sm"
          className="self-start sm:self-auto bg-primary text-primary-foreground hover:bg-primary/90"
          onClick={onUpdatePaymentMethod}
        >
          Update Card
        </Button>
      </CardContent>
    </Card>
  );
}
