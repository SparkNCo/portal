"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Plus } from "lucide-react";
import { Button } from "../components/ui/button";
import { useUser } from "context/UserContext";
import { API_JSON_HEADERS } from "@/lib/api-headers";
import { useResolvedCustomerId } from "@/hooks/use-resolved-customer-id";
import {
  DeveloperDetailsModal,
  type DeveloperDetails,
} from "./developer-details-modal";
import { AddDeveloperModal } from "./add-developer-modal";
import { EditInternalDeveloperModal } from "./edit-internal-developer-modal";

export function StaffingSection({ customerId }: { readonly customerId?: string }) {
  const { user, profile, loading } = useUser();
  const [selectedDeveloper, setSelectedDeveloper] = useState<DeveloperDetails | null>(null);
  const [editingDeveloper, setEditingDeveloper] = useState<DeveloperDetails | null>(null);

  const resolvedId = useResolvedCustomerId(customerId);

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
        {
          headers: API_JSON_HEADERS,
        },
      );

      if (!res.ok) {
        throw new Error("Failed to fetch assignments");
      }

      return res.json();
    },
  });

  if (isLoading) {
    return <div className="p-4 smalltext">Loading team...</div>;
  }

  if (error) {
    return <div className="p-4 smalltext text-red-500">Error loading team</div>;
  }

  // Stakeholders now have their own dedicated tab (StakeholdersSection) —
  // showing them here too would just duplicate that list.
  const teamMembers = assignments
    .filter((item: any) => item.role !== "stakeholder")
    .map((item: any) => ({
    name: item.firstName
      ? `${item.firstName} ${item.lastName ?? ""}`.trim()
      : item.userName || item?.email || "Unknown",
    email: item.email || "",
    role: item.role,
    hours: item.allocation,
    joined: item.joined,
    status: "active",
    // Fields come flat on the assignment row (getAssignmentsByCustomer.ts
    // spreads the user directly onto it), not nested under `.users` — that
    // nested shape doesn't exist here, so it was always falling through to
    // "U".
    avatar: item.firstName
      ? `${item.firstName[0]}${item.lastName?.[0] ?? ""}`.toUpperCase()
      : (item.userName?.[0] ?? item.email?.[0] ?? "U").toUpperCase(),
    bio: item.bio ?? null,
    techStack: Array.isArray(item.tech_stack) ? item.tech_stack : [],
    userId: item.user_id,
    assignmentId: item.assignment_id,
    developerType: item.developer_type ?? "spark_fde",
    firstName: item.firstName ?? "",
    lastName: item.lastName ?? "",
    phoneNumber: item.phoneNumber ?? "",
  }));

  const totalHours = teamMembers.reduce(
    (sum: number, m: any) => sum + m.hours,
    0,
  );

  return (
    <Card className="bg-background border-border text-foreground">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle className="body font-semibold flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          Team Members
        </CardTitle>

        <div className="flex items-center gap-2">
          {profile?.role === "customer" && resolvedId && (
            <AddDeveloperModal
              customerId={resolvedId}
              clientName={profile?.clientName ?? undefined}
              requestedBy={profile?.email ?? user?.email ?? undefined}
            />
          )}

          {/* 🔥 cal.com button */}
          <Button
            size="sm"
            className="bg-primary text-primary-foreground hover:bg-primary/90 smalltext"
            onClick={() => {
              const calLink = new URL(
                "https://cal.com/kabir-malkani-glnivq/15min",
              );

              /*             if (customerId) {
                calLink.searchParams.set("notes", `Customer ID: ${customerId}`);
              } */

              const firstEmail = assignments[0]?.users?.email;
              calLink.searchParams.set(
                "attendee_email",
                firstEmail || user?.email || "",
              );

              // Open booking page in a new tab
              window.open(calLink.toString(), "_blank");
            }}
          >
            <Plus className="h-4 w-4 mr-1" />
            Request Change
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {teamMembers.map((member: any, i: number) => (
            <button
              key={i}
              type="button"
              onClick={() => setSelectedDeveloper(member)}
              className="flex flex-col items-center gap-2 rounded-lg border border-border bg-card p-4 text-center transition-colors hover:bg-card/80"
            >
              {/* Dark circle + orange initials, sized to swap for a real
                  photo later — everything else (email, joined date, bio,
                  skills) lives in the profile modal this opens, not here. */}
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-card-foreground text-lg font-semibold text-primary">
                {member.avatar}
              </div>
              <p title={member.name} className="smalltext font-medium text-card-foreground truncate max-w-full">
                {member.name}
              </p>
              <p className="smalltext text-card-foreground/60">
                {member.role === "developer"
                  ? member.developerType === "internal"
                    ? "Internal Developer"
                    : "Spark & Co Developer"
                  : member.role}
              </p>
              {member.hours ? (
                <p className="smalltext text-card-foreground/60">{member.hours}h/week</p>
              ) : null}
            </button>
          ))}
        </div>

        {/* <div className="mt-4 pt-4 border-t border-border">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Total Weekly Hours</span>
            <span className="font-medium text-background-foreground">
              {totalHours} hours
            </span>
          </div>
        </div> */}
      </CardContent>

      <DeveloperDetailsModal
        developer={selectedDeveloper}
        onClose={() => setSelectedDeveloper(null)}
        onEdit={
          selectedDeveloper?.developerType === "internal" &&
          (profile?.role === "admin" || profile?.role === "customer")
            ? () => {
                setEditingDeveloper(selectedDeveloper);
                setSelectedDeveloper(null);
              }
            : undefined
        }
      />

      {editingDeveloper && resolvedId && (
        <EditInternalDeveloperModal
          developer={editingDeveloper}
          customerId={resolvedId}
          onClose={() => setEditingDeveloper(null)}
        />
      )}
    </Card>
  );
}
