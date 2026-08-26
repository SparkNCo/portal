"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Briefcase, UserCheck } from "lucide-react";
import { API_HEADERS, API_JSON_HEADERS } from "@/lib/api-headers";

type User = {
  id: string;
  email: string;
  role: string;
  clientName?: string;
};

type Props = Readonly<{
  userId: string;
  userEmail?: string;
  userName?: string;
  userRole?: string;
  customers: User[];
  onClose: () => void;
}>;

export default function AssignCustomerModal({
  userId,
  userEmail,
  userName,
  userRole = "developer",
  customers,
  onClose,
}: Props) {
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

  const name = userName || userEmail || "User";
  const avatar = (userEmail || userName || "??").slice(0, 2).toUpperCase();

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="w-[95vw] sm:w-full sm:max-w-lg max-h-[85vh] overflow-y-auto overflow-x-hidden"
        aria-describedby={undefined}
      >
        {/* Orange accent bar ties the modal back to the card it was opened from. */}
        <div className="-mx-6 -mt-6 h-1 bg-gradient-to-r from-primary via-primary/60 to-transparent" />

        <DialogHeader className="pt-4">
          <div className="flex min-w-0 items-center gap-3.5 pr-6">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary ring-2 ring-primary/30">
              {avatar}
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <DialogTitle className="truncate text-primary">{name}</DialogTitle>
              {userEmail && (
                <p className="smalltext text-muted-foreground truncate">{userEmail}</p>
              )}
              <Badge
                variant="outline"
                className="smalltext border-primary/30 bg-primary/10 text-primary capitalize"
              >
                {userRole}
              </Badge>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 pt-4 mt-1 border-t border-border">
          <div>
            <p className="flex items-center gap-1.5 smalltext font-medium text-foreground mb-1.5">
              <Briefcase className="h-3.5 w-3.5 text-primary" />
              Current Assignments
            </p>
            {(() => {
              if (loadingExisting) return <p className="smalltext text-muted-foreground">Loading...</p>;
              if (existing.length === 0)
                return (
                  <div className="rounded-lg bg-muted/40 p-3">
                    <p className="smalltext text-muted-foreground">None yet.</p>
                  </div>
                );
              return (
                <div className="space-y-1.5">
                  {(existing as any[]).map((a) => (
                    <div
                      key={a.id}
                      className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2 smalltext"
                    >
                      <span className="text-foreground font-medium truncate">
                        {a.clientName ?? a.customer_email}
                      </span>
                      {userRole !== "stakeholder" && (
                        <span className="text-muted-foreground shrink-0 ml-2">
                          {a.allocation}h/wk
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>

          <div>
            <p className="flex items-center gap-1.5 smalltext font-medium text-foreground mb-1.5">
              <UserCheck className="h-3.5 w-3.5 text-primary" />
              Add Assignment
            </p>
            <Select value={selectedCustomer || undefined} onValueChange={setSelectedCustomer}>
              <SelectTrigger className="smalltext bg-secondary border-0">
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
              <div className="mt-3 space-y-1.5">
                <Label htmlFor="allocation-input" className="smalltext">
                  Weekly Allocation (Hours)
                </Label>
                <Input
                  id="allocation-input"
                  type="number"
                  min={1}
                  step={1}
                  className="smalltext bg-secondary border-0 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
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
            <Button variant="ghost" size="sm" className="smalltext" onClick={onClose}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="smalltext"
              disabled={!selectedCustomer || (userRole !== "stakeholder" && !allocation) || isPending || assignedCustomerIds.has(selectedCustomer)}
              onClick={() => mutate()}
            >
              {isPending ? "Assigning..." : "Assign"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
