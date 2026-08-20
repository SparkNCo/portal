"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/components/ui/button";
import { UserCheck } from "lucide-react";
import { API_HEADERS, API_JSON_HEADERS } from "@/lib/api-headers";

type User = {
  id: string;
  email: string;
  role: string;
  clientName?: string;
};

type Props = Readonly<{
  userId: string;
  userRole?: string;
  customers: User[];
  onClose: () => void;
}>;

export default function AssignCustomerModal({ userId, userRole = "developer", customers, onClose }: Props) {
  const queryClient = useQueryClient();
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [allocation, setAllocation] = useState<number | "">("");

  const { data: existing = [], isLoading: loadingExisting } = useQuery({
    queryKey: ["developer-assignments", userId],
    queryFn: async () => {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/assignments?developer=${userId}`,
        { headers: API_HEADERS },
      );
      return res.json();
    },
  });

  const assignedCustomerIds = new Set((existing as any[]).map((a) => a.customer_id));

  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/assignments`, {
        method: "POST",
        headers: API_JSON_HEADERS,
        body: JSON.stringify({ user_id: userId, customer_id: selectedCustomer, role: userRole, allocation: Number(allocation) }),
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
      <Card className="w-96 bg-background border-border shadow-lg text-foreground">
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2 text-primary">
            <UserCheck className="h-4 w-4 text-primary" />
            {userRole === "stakeholder" ? "Assign Stakeholder" : "Assign Developer"}
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
                    <span className="text-foreground font-medium">{a.clientName ?? a.customer_email}</span>
                    {userRole !== "stakeholder" && <span className="text-muted-foreground">{a.allocation}h/wk</span>}
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
            <Select value={selectedCustomer || undefined} onValueChange={setSelectedCustomer}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Select Customer" />
              </SelectTrigger>
              <SelectContent>
                {customers.map((c) => (
                  <SelectItem
                    key={c.id}
                    value={c.id}
                    disabled={assignedCustomerIds.has(c.id)}
                  >
                    {c.clientName ?? c.email}{assignedCustomerIds.has(c.id) ? " (already assigned)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {userRole !== "stakeholder" && (
              <div className="mt-3">
                <label htmlFor="allocation-input" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground block mb-1">
                  Allocation (hrs/week)
                </label>
                <input
                  id="allocation-input"
                  type="number"
                  min={1}
                  step={1}
                  className="w-full rounded border-2 border-transparent focus:border-primary focus:outline-none p-2 bg-secondary text-secondary-foreground text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  placeholder="e.g. 20"
                  value={allocation}
                  onChange={(e) =>
                    setAllocation(e.target.value === "" ? "" : Math.round(Number(e.target.value)))
                  }
                />
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!selectedCustomer || (userRole !== "stakeholder" && !allocation) || isPending || assignedCustomerIds.has(selectedCustomer)}
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
