"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { useState } from "react";

export function BillingPaymentModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!stripe || !elements) return;
    setLoading(true);

    const { error } = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
    });

    setLoading(false);

    if (!error) {
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent
        className="
          max-w-md
          max-h-[90vh]
          overflow-hidden
          flex
          flex-col
        "
      >
        {/* HEADER (fixed) */}
        <DialogHeader className="shrink-0">
          <DialogTitle>Pay Invoice</DialogTitle>
        </DialogHeader>

        {/* SCROLLABLE CONTENT */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-4">
          <PaymentElement />
        </div>

        {/* FOOTER (fixed) */}
        <div className="pt-4 shrink-0">
          <Button
            onClick={handleSubmit}
            disabled={!stripe || loading}
            className="w-full"
          >
            {loading ? "Processing..." : "Pay now"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
