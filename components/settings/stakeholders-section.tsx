"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Contact } from "lucide-react";
import { useUser } from "context/UserContext";
import { API_JSON_HEADERS } from "@/lib/api-headers";
import { useResolvedCustomerId } from "@/hooks/use-resolved-customer-id";
import { AddStakeholderModal } from "./add-stakeholder-modal";

// Reuses the exact same `["assignments", resolvedId]` query StaffingSection
// already fetches (same endpoint, same cache key) — this just filters the
// same list down to role "stakeholder" instead of showing everyone, so both
// sections share one network call when viewed back to back.
export function StakeholdersSection({ customerId }: { readonly customerId?: string }) {
  const { profile, loading } = useUser();
  const resolvedId = useResolvedCustomerId(customerId);
  const canAdd = profile?.role === "customer" || profile?.role === "stakeholder";

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
          <div className="space-y-3">
            {stakeholders.map((s: any) => {
              const name = s.firstName
                ? `${s.firstName} ${s.lastName ?? ""}`.trim()
                : s.userName || s.email || "Unknown";
              const avatar = (
                s.firstName?.[0] ??
                s.userName?.[0] ??
                s.email?.[0] ??
                "U"
              ).toUpperCase();

              return (
                <div
                  key={s.assignment_id}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg border border-transparent bg-card/90 p-4"
                >
                  <div className="flex flex-1 items-center gap-3 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium text-primary">
                      {avatar}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p title={name} className="smalltext font-medium text-card-foreground truncate">
                        {name}
                      </p>
                      <p title={s.email} className="smalltext text-card-foreground/60 truncate">
                        {s.email}
                      </p>
                    </div>
                  </div>

                  {s.joined && (
                    <div className="flex items-center gap-2 sm:shrink-0">
                      <p className="smalltext text-card-foreground/60">Joined</p>
                      <p className="smalltext text-card-foreground">
                        {new Date(s.joined).toLocaleDateString()}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
