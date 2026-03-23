"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

type Props = {
  onClose: () => void;
};

export default function AddClientModal({ onClose }: Props) {
  const [email, setEmail] = useState("");
  const [stripeId, setStripeId] = useState("");
  const [linearId, setLinearId] = useState("");

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
            stripe_customer_id: stripeId,
            linear_initiative_id: linearId,
          }),
        },
      );

      if (!res.ok) {
        throw new Error("Failed to create client");
      }

      return res.json();
    },
    onSuccess: () => {
      // 🔥 refresh users (and later customers if you add query)
      queryClient.invalidateQueries({ queryKey: ["users"] });
      onClose();
    },
  });

  const handleSubmit = () => {
    if (!email || !stripeId || !linearId) return;
    mutate();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
      <div className="bg-white p-6 rounded space-y-4 w-80">
        <h2 className="text-lg font-semibold">Add Client</h2>

        {/* Email */}
        <input
          className="w-full border p-2 rounded"
          placeholder="Client email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        {/* Stripe ID */}
        <input
          className="w-full border p-2 rounded"
          placeholder="Stripe Customer ID"
          value={stripeId}
          onChange={(e) => setStripeId(e.target.value)}
        />

        {/* Linear Initiative ID */}
        <input
          className="w-full border p-2 rounded"
          placeholder="Linear Initiative ID"
          value={linearId}
          onChange={(e) => setLinearId(e.target.value)}
        />

        {/* Error */}
        {error && (
          <p className="text-sm text-red-500">{(error as Error).message}</p>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <button className="border px-3 py-1 rounded" onClick={onClose}>
            Cancel
          </button>

          <button
            className="bg-black text-white px-3 py-1 rounded"
            onClick={handleSubmit}
            disabled={isPending || !email || !stripeId || !linearId}
          >
            {isPending ? "Creating..." : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}
