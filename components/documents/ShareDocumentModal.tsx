"use client";

import { useState } from "react";
import { Button } from "@/components/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useUser } from "context/UserContext";
import { API_JSON_HEADERS } from "@/lib/api-headers";

export function useShareDocument() {
  return useMutation({
    mutationFn: async ({
      document_id,
      emails,
      user_id,
    }: {
      document_id: number;
      emails: string[];
      user_id: string | undefined;
    }) => {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/storage/share`,
        {
          method: "POST",
          headers: API_JSON_HEADERS,
          body: JSON.stringify({
            document_id,
            emails,
            user_id,
          }),
        },
      );

      if (!res.ok) {
        throw new Error("Failed to share document");
      }

      return res.json();
    },
  });
}

type CustomerSummary = {
  id: string;
  email: string | null;
  clientName: string | null;
  linear_slug: string | null;
  userName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
};

type InitiativeUser = {
  email: string;
  name: string;
  role: string;
};

function displayName(u: { firstName?: string | null; lastName?: string | null; userName?: string | null; email?: string | null }) {
  const full = [u.firstName, u.lastName].filter(Boolean).join(" ").trim();
  return full || u.userName || u.email || "";
}

// Everyone on the document's initiative — the customer plus the developers
// and stakeholders assigned to it — resolved from the document's own
// project_slug (its customer's linear_slug), so it works the same for every
// role.
function useInitiativeUsers(projectSlug: string | null | undefined, enabled: boolean) {
  const { data: customers, isLoading: customersLoading } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/users?type=customers`, {
        headers: API_JSON_HEADERS,
      });
      if (!res.ok) throw new Error("Failed to fetch customers");
      return res.json() as Promise<CustomerSummary[]>;
    },
    enabled,
  });
  const customer = projectSlug
    ? customers?.find((c) => c.linear_slug?.toLowerCase() === projectSlug.toLowerCase())
    : undefined;

  const { data: assignments, isLoading: assignmentsLoading } = useQuery({
    queryKey: ["assignments", customer?.id],
    queryFn: async () => {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/assignments?customer_id=${customer!.id}`,
        { headers: API_JSON_HEADERS },
      );
      if (!res.ok) throw new Error("Failed to fetch initiative users");
      return res.json() as Promise<
        { email: string | null; role: string; userName?: string | null; firstName?: string | null; lastName?: string | null }[]
      >;
    },
    enabled: enabled && !!customer?.id,
  });

  const byEmail = new Map<string, InitiativeUser>();
  if (customer?.email) {
    byEmail.set(customer.email, { email: customer.email, name: customer.clientName ?? displayName(customer), role: "customer" });
  }
  (assignments ?? []).forEach((a) => {
    if (a.email && !byEmail.has(a.email)) byEmail.set(a.email, { email: a.email, name: displayName(a), role: a.role });
  });

  return {
    users: Array.from(byEmail.values()),
    isLoading: customersLoading || (!!customer?.id && assignmentsLoading),
    initiativeName: customer?.clientName ?? null,
  };
}

const ROLE_ORDER: Record<string, number> = { customer: 0, stakeholder: 1, developer: 2 };

const PERMISSION_LABELS: Record<string, string> = {
  owner: "Owner",
  write: "Can edit",
  read: "Can view",
};

// Who already has access to the document, by lowercased email.
function useDocumentAccess(documentId: number | undefined, callerId: string | undefined, enabled: boolean) {
  const { data, isLoading } = useQuery({
    queryKey: ["document-permissions", documentId],
    queryFn: async () => {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/storage/permissions?document_id=${documentId}&user_id=${callerId}`,
        { headers: API_JSON_HEADERS },
      );
      if (!res.ok) throw new Error("Failed to load who has access");
      return res.json() as Promise<{ email: string; permission: string }[]>;
    },
    enabled: enabled && !!documentId && !!callerId,
  });
  const byEmail = new Map((data ?? []).map((p) => [p.email.toLowerCase(), p.permission]));
  return { accessByEmail: byEmail, isLoading };
}

export function ShareDocumentModal({
  isOpen,
  onClose,
  document,
  id,
}: {
  isOpen: boolean;
  onClose: () => void;
  document: any;
  id: string | undefined;
}) {
  const { profile } = useUser();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const shareMutation = useShareDocument();
  const { users, isLoading: usersLoading, initiativeName } = useInitiativeUsers(document?.project_slug, isOpen);
  const { accessByEmail, isLoading: accessLoading } = useDocumentAccess(document?.id, id, isOpen);
  const isLoading = usersLoading || accessLoading;
  const accessOf = (email: string) => accessByEmail.get(email.toLowerCase());

  // You can't share with yourself. People who already have access are listed
  // (checked and locked) but can't be picked again.
  const options = users
    .filter((u) => u.email.toLowerCase() !== profile?.email?.toLowerCase())
    .sort((a, b) => (ROLE_ORDER[a.role] ?? 9) - (ROLE_ORDER[b.role] ?? 9) || a.name.localeCompare(b.name));
  const selectable = options.filter((u) => !accessOf(u.email));
  const allSelected = selectable.length > 0 && selectable.every((u) => selected.has(u.email));

  const close = () => {
    setSelected(new Set());
    onClose();
  };

  const toggle = (email: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });

  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(selectable.map((u) => u.email)));

  const handleShare = () => {
    shareMutation.mutate(
      {
        document_id: document.id,
        emails: Array.from(selected),
        user_id: id,
      },
      {
        onSuccess: (res) => {
          const sharedCount = res?.shared_with?.length ?? selected.size;
          toast.success(
            sharedCount > 0
              ? `Shared with ${sharedCount} ${sharedCount === 1 ? "person" : "people"}`
              : "Everyone selected already has access",
          );
          queryClient.invalidateQueries({ queryKey: ["documents"] });
          queryClient.invalidateQueries({ queryKey: ["document-permissions", document.id] });
          close();
        },
        onError: () => toast.error("Failed to share document. Please try again."),
      },
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && close()}>
      <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Share Document</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 pt-1">
          <p className="smalltext text-muted-foreground">
            Pick who on {initiativeName ?? "this initiative"} should get access to{" "}
            <span className="font-medium text-foreground">{document?.name}</span>. They can open and download it.
          </p>

          {isLoading ? (
            <p className="smalltext text-muted-foreground py-4">Loading people…</p>
          ) : options.length === 0 ? (
            <p className="smalltext text-muted-foreground py-4">There's nobody else on this initiative to share with.</p>
          ) : (
            <div className="rounded-md border border-border">
              <label className="flex cursor-pointer items-center gap-3 border-b border-border px-3 py-2 smalltext font-medium">
                <Checkbox
                  id="share-select-all"
                  checked={allSelected}
                  onCheckedChange={toggleAll}
                  disabled={selectable.length === 0}
                />
                Select all
              </label>
              <ul className="max-h-64 overflow-y-auto">
                {options.map((u) => {
                  const access = accessOf(u.email);
                  return (
                  <li key={u.email}>
                    <label
                      className={`flex items-center gap-3 px-3 py-2 ${
                        access ? "cursor-default opacity-70" : "cursor-pointer hover:bg-secondary/30"
                      }`}
                    >
                      <Checkbox
                        checked={!!access || selected.has(u.email)}
                        disabled={!!access}
                        onCheckedChange={() => toggle(u.email)}
                        aria-label={access ? `${u.name} already has access` : `Share with ${u.name}`}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate smalltext font-medium text-foreground">{u.name}</span>
                        {u.name !== u.email && (
                          <span className="block truncate smalltext text-muted-foreground">{u.email}</span>
                        )}
                      </span>
                      <span className="shrink-0 text-right smalltext text-muted-foreground">
                        <span className="block capitalize">{u.role}</span>
                        {access && (
                          <span className="block text-success">{PERMISSION_LABELS[access] ?? "Has access"}</span>
                        )}
                      </span>
                    </label>
                  </li>
                  );
                })}
              </ul>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button onClick={handleShare} disabled={selected.size === 0 || shareMutation.isPending}>
              {shareMutation.isPending
                ? "Sharing..."
                : selected.size > 0
                  ? `Share with ${selected.size}`
                  : "Share"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
