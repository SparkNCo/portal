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
        <CardContent className="flex items-center justify-between ">
          <div>
            <p className="text-sm text-muted-foreground mt-4">Payment Method</p>
            <p className="text-base font-medium text-muted-foreground">
              No payment method added
            </p>
          </div>
          <Button size="sm" onClick={onUpdatePaymentMethod}>
            Add Card
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-background">
      <CardContent className="flex items-center justify-between space-x-4">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
            <CreditCard className="h-6 w-6 text-muted-foreground" />
          </div>

          <div>
            <p className="text-sm text-muted-foreground mt-4">Payment Method</p>
            <p className="text-lg font-semibold">
              {paymentMethod.brand.toUpperCase()} ****{paymentMethod.last4}
            </p>
            <p className="text-sm text-muted-foreground">
              Expires {paymentMethod.expMonth}/{paymentMethod.expYear}
            </p>
          </div>
        </div>

        <Button size="sm" onClick={onUpdatePaymentMethod}>
          Update Card
        </Button>
      </CardContent>
    </Card>
  );
}
