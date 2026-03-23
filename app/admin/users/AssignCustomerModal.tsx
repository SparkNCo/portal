"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

type User = {
  id: string;
  email: string;
  role: string;
};

type Props = {
  userId: string;
  customers: User[];
  onClose: () => void;
};

export default function AssignCustomerModal({
  userId,
  customers,
  onClose,
}: Props) {
  const queryClient = useQueryClient();
  const [selectedCustomer, setSelectedCustomer] = useState("");

  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_ENDPOINT}/assignments`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_APIKEY}`,
            apikey: process.env.NEXT_PUBLIC_APIKEY!,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            user_id: userId,
            customer_id: selectedCustomer,
          }),
        },
      );

      if (!res.ok) {
        throw new Error("Failed to assign user");
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
      <div className="bg-white p-6 rounded space-y-4 w-80">
        <h2 className="text-lg font-semibold">Assign Developer</h2>

        <select
          className="w-full border p-2 rounded"
          value={selectedCustomer}
          onChange={(e) => setSelectedCustomer(e.target.value)}
        >
          <option value="">Select Customer</option>

          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.email}
            </option>
          ))}
        </select>

        <div className="flex justify-end gap-2">
          <button className="border px-3 py-1 rounded" onClick={onClose}>
            Cancel
          </button>

          <button
            className="bg-black text-white px-3 py-1 rounded"
            onClick={() => mutate()}
            disabled={!selectedCustomer || isPending}
          >
            {isPending ? "Assigning..." : "Assign"}
          </button>
        </div>
      </div>
    </div>
  );
}
