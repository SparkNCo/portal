"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/components/ui/button";
import { UserPlus } from "lucide-react";

type Props = {
  onClose: () => void;
};

export default function AddClientModal({ onClose }: Props) {
  const [email, setEmail] = useState("");
  const [stripeId, setStripeId] = useState("");
  const [linearSlug, setLinearSlug] = useState("");

  const queryClient = useQueryClient();

  const { mutate, isPending, error } = useMutation({
    mutationFn: async () => {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_ENDPOINT}/users?type=customer`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_APIKEY}`,
            apikey: process.env.NEXT_PUBLIC_APIKEY!,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email,
            customer_id: stripeId,
            linear_slug: linearSlug,
          }),
        },
      );

      if (!res.ok) throw new Error("Failed to create client");

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      onClose();
    },
  });

  const inputClass =
    "w-full rounded border-2 border-transparent focus:border-primary focus:outline-none p-2 bg-secondary text-foreground text-sm";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <Card className="w-96 bg-background border-border shadow-lg">
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-accent" />
            Add Customer
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <input
            className={inputClass}
            placeholder="Client Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className={inputClass}
            placeholder="Stripe Customer ID"
            value={stripeId}
            onChange={(e) => setStripeId(e.target.value)}
          />
          <input
            className={inputClass}
            placeholder="Linear Slug"
            value={linearSlug}
            onChange={(e) => setLinearSlug(e.target.value)}
          />

          {error && (
            <p className="text-sm text-destructive">
              {(error as Error).message}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={isPending || !email || !stripeId || !linearSlug}
              onClick={() => mutate()}
            >
              {isPending ? "Creating..." : "Create"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
