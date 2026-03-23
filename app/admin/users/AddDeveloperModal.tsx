"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

type Props = {
  onClose: () => void;
};

export default function AddDeveloperModal({ onClose }: Props) {
  const [email, setEmail] = useState("");
  const queryClient = useQueryClient();

  const { mutate, isPending, error } = useMutation({
    mutationFn: async () => {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_ENDPOINT}/users?type=developer`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_APIKEY}`,
            apikey: process.env.NEXT_PUBLIC_APIKEY!,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email,
            role: "developer",
          }),
        },
      );

      if (!res.ok) {
        throw new Error("Failed to create developer");
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] }); // 🔥 refetch users
      onClose();
    },
  });

  const handleSubmit = () => {
    if (!email) return;
    mutate();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
      <div className="bg-white p-6 rounded space-y-4 w-80">
        <h2 className="text-lg font-semibold">Add Developer</h2>

        <input
          className="w-full border p-2 rounded"
          placeholder="Developer email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        {error && (
          <p className="text-sm text-red-500">{(error as Error).message}</p>
        )}

        <div className="flex justify-end gap-2">
          <button className="border px-3 py-1 rounded" onClick={onClose}>
            Cancel
          </button>

          <button
            className="bg-black text-white px-3 py-1 rounded"
            onClick={handleSubmit}
            disabled={isPending || !email}
          >
            {isPending ? "Creating..." : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}
