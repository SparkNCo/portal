"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/components/ui/button";
import { UserCheck } from "lucide-react";

type User = {
  id: string;
  email: string;
  role: string;
};

type Props = Readonly<{
  userId: string;
  customers: User[];
  onClose: () => void;
}>;

export default function AssignCustomerModal({ userId, customers, onClose }: Props) {
  const queryClient = useQueryClient();
  const [selectedCustomer, setSelectedCustomer] = useState("");

  const { data: existing = [], isLoading: loadingExisting } = useQuery({
    queryKey: ["developer-assignments", userId],
    queryFn: async () => {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_ENDPOINT}/assignments?developer=${userId}`,
        {
          headers: {
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_APIKEY}`,
            apikey: process.env.NEXT_PUBLIC_APIKEY!,
          },
        },
      );
      return res.json();
    },
  });

  const assignedCustomerIds = new Set((existing as any[]).map((a) => a.customer_id));

  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${process.env.NEXT_PUBLIC_ENDPOINT}/assignments`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_APIKEY}`,
          apikey: process.env.NEXT_PUBLIC_APIKEY!,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ user_id: userId, customer_id: selectedCustomer }),
      });
      if (!res.ok) throw new Error("Failed to assign user");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["developer-assignments", userId] });
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
          {/* Current assignments */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Current Assignments
            </p>
            {(() => {
              if (loadingExisting) return <p className="text-xs text-muted-foreground animate-pulse">Loading...</p>;
              if (existing.length === 0) return <p className="text-xs text-muted-foreground italic">None</p>;
              return (
                <div className="space-y-1.5">
                  {(existing as any[]).map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between rounded-md border border-border bg-secondary/30 px-3 py-1.5 text-xs"
                  >
                    <span className="text-foreground font-medium">{a.customer_email}</span>
                    <span className="text-muted-foreground">{a.allocation}h/wk</span>
                  </div>
                  ))}
                </div>
              );
            })()}
          </div>

          <div className="border-t border-border pt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Add Assignment
            </p>
            <select
              className="w-full rounded border-2 border-transparent focus:border-primary focus:outline-none p-2 bg-secondary text-foreground text-sm"
              value={selectedCustomer}
              onChange={(e) => setSelectedCustomer(e.target.value)}
            >
              <option value="">Select Customer</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id} disabled={assignedCustomerIds.has(c.id)}>
                  {c.email}{assignedCustomerIds.has(c.id) ? " (already assigned)" : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!selectedCustomer || isPending || assignedCustomerIds.has(selectedCustomer)}
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
