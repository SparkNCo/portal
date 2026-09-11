"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Contact } from "lucide-react";
import { useUser } from "context/UserContext";
import { API_JSON_HEADERS } from "@/lib/api-headers";
import { useResolvedCustomerId } from "@/hooks/use-resolved-customer-id";
import { AddStakeholderModal } from "./add-stakeholder-modal";
// Reused straight from Admin → Users rather than duplicating a second "all
// their data" profile modal — same View/Edit pair, same admin-session-gated
// PATCH on the backend regardless of where it's opened from. ViewStakeholderModal
// already hides its own Edit button whenever `onEdit` is omitted, which is
// exactly the "admins only" gate this card view needs.
import ViewStakeholderModal from "@/app/admin/users/ViewStakeholderModal";
import EditStakeholderModal from "@/app/admin/users/EditStakeholderModal";

type StakeholderAssignment = {
  assignment_id: string;
  user_id: string;
  email: string;
  userName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  phoneNumber?: string | null;
  joined?: string | null;
};

// Reuses the exact same `["assignments", resolvedId]` query StaffingSection
// already fetches (same endpoint, same cache key) — this just filters the
// same list down to role "stakeholder" instead of showing everyone, so both
// sections share one network call when viewed back to back.
export function StakeholdersSection({ customerId }: { readonly customerId?: string }) {
  const { profile, loading } = useUser();
  const resolvedId = useResolvedCustomerId(customerId);
  const canAdd = profile?.role === "customer" || profile?.role === "stakeholder";
  const isAdmin = profile?.role === "admin";
  const [viewingStakeholder, setViewingStakeholder] = useState<StakeholderAssignment | null>(null);
  const [editingStakeholder, setEditingStakeholder] = useState<StakeholderAssignment | null>(null);

  const {
    data: assignments = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["assignments", resolvedId],
    enabled: !!resolvedId && !loading,
    queryFn: async () => {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/assignments?customer_id=${resolvedId}`,
        { headers: API_JSON_HEADERS },
      );
      if (!res.ok) throw new Error("Failed to fetch stakeholders");
      return res.json();
    },
  });

  if (isLoading) {
    return <div className="p-4 smalltext">Loading stakeholders...</div>;
  }

  if (error) {
    return <div className="p-4 smalltext text-red-500">Error loading stakeholders</div>;
  }

  const stakeholders = (assignments as any[]).filter((a) => a.role === "stakeholder");

  return (
    <Card className="bg-background border-border text-foreground">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle className="body font-semibold flex items-center gap-2">
          <Contact className="h-4 w-4 text-primary" />
          Stakeholders
        </CardTitle>

        {canAdd && resolvedId && (
          <AddStakeholderModal
            customerId={resolvedId}
            clientName={profile?.clientName ?? undefined}
            requestedBy={profile?.email ?? undefined}
          />
        )}
      </CardHeader>

      <CardContent>
        {stakeholders.length === 0 ? (
          <p className="smalltext text-muted-foreground italic">
            No stakeholders yet.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {stakeholders.map((s: any) => {
              const name = s.firstName
                ? `${s.firstName} ${s.lastName ?? ""}`.trim()
                : s.userName || s.email || "Unknown";
              // Dark circle + orange initials — same avatar treatment as
              // StaffingSection's team cards.
              const avatar = s.firstName
                ? `${s.firstName[0]}${s.lastName?.[0] ?? ""}`.toUpperCase()
                : (s.userName?.[0] ?? s.email?.[0] ?? "U").toUpperCase();

              return (
                <button
                  key={s.assignment_id}
                  type="button"
                  onClick={() => setViewingStakeholder(s)}
                  className="flex flex-col items-center gap-2 rounded-lg border border-border bg-card p-4 text-center hover:border-primary/40 transition-colors"
                >
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-card-foreground text-lg font-semibold text-primary">
                    {avatar}
                  </div>
                  <p title={name} className="smalltext font-medium text-card-foreground truncate max-w-full">
                    {name}
                  </p>
                  <p title={s.email} className="smalltext text-card-foreground/60 truncate max-w-full">
                    {s.email}
                  </p>
                  {s.joined && (
                    <p className="smalltext text-card-foreground/60">
                      Joined {new Date(s.joined).toLocaleDateString()}
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </CardContent>

      {viewingStakeholder && (
        <ViewStakeholderModal
          userId={viewingStakeholder.user_id}
          userEmail={viewingStakeholder.email}
          firstName={viewingStakeholder.firstName}
          lastName={viewingStakeholder.lastName}
          userName={viewingStakeholder.userName}
          phoneNumber={viewingStakeholder.phoneNumber}
          onClose={() => setViewingStakeholder(null)}
          onEdit={
            isAdmin
              ? () => {
                  setEditingStakeholder(viewingStakeholder);
                  setViewingStakeholder(null);
                }
              : undefined
          }
        />
      )}

      {editingStakeholder && (
        <EditStakeholderModal
          userId={editingStakeholder.user_id}
          userEmail={editingStakeholder.email}
          firstName={editingStakeholder.firstName}
          lastName={editingStakeholder.lastName}
          userName={editingStakeholder.userName}
          phoneNumber={editingStakeholder.phoneNumber}
          onClose={() => setEditingStakeholder(null)}
        />
      )}
    </Card>
  );
}
