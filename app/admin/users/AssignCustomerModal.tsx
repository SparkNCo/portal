"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/components/ui/button";
import { UserCheck } from "lucide-react";

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

      if (!res.ok) throw new Error("Failed to assign user");

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <Card className="w-96 bg-background border-border shadow-lg">
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-accent" />
            Assign Developer
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <select
            className="w-full rounded border-2 border-transparent focus:border-primary focus:outline-none p-2 bg-secondary text-foreground text-sm"
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
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!selectedCustomer || isPending}
              onClick={() => mutate()}
            >
              {isPending ? "Assigning..." : "Assign"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
