"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Plus, Clock } from "lucide-react";
import { Button } from "../components/ui/button";
import { useUser } from "context/UserContext";
import { API_JSON_HEADERS } from "@/lib/api-headers";
import {
  DeveloperDetailsModal,
  type DeveloperDetails,
} from "./developer-details-modal";
import { AddDeveloperModal } from "./add-developer-modal";
import { EditInternalDeveloperModal } from "./edit-internal-developer-modal";

const statusColors = {
  active: "border-transparent bg-muted text-primary",
  pending: "bg-warning/20 text-warning",
  inactive: "bg-muted text-muted-foreground",
};

export function StaffingSection({ customerId }: { readonly customerId?: string }) {
  const { user, profile, loading } = useUser();
  const [selectedDeveloper, setSelectedDeveloper] = useState<DeveloperDetails | null>(null);
  const [editingDeveloper, setEditingDeveloper] = useState<DeveloperDetails | null>(null);

  const resolvedId = customerId ?? profile?.id;

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
    return <div className="p-4 text-sm">Loading team...</div>;
  }

  if (error) {
    return <div className="p-4 text-sm text-red-500">Error loading team</div>;
  }

  const teamMembers = assignments.map((item: any) => ({
    name: item.userName || item?.email || "Unknown",
    email: item.email || "",
    role: item.role,
    hours: item.allocation,
    joined: item.joined,
    status: "active",
    avatar:
      item.users?.userName?.[0]?.toUpperCase() ??
      item.users?.email?.[0]?.toUpperCase() ??
      "U",
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
        <CardTitle className="text-base font-semibold flex items-center gap-2">
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
            className="bg-primary text-primary-foreground hover:bg-primary/90"
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
        <div className="space-y-3">
          {teamMembers.map((member: any, i: number) => (
            <button
              key={i}
              type="button"
              onClick={() => setSelectedDeveloper(member)}
              className="flex w-full flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg border border-transparent bg-card/75 p-4 text-left cursor-pointer transition-colors hover:bg-card/50"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium text-primary">
                  {member.avatar}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p title={member.name} className="text-sm font-medium text-card-foreground truncate max-w-[15ch]">
                      {member.name}
                    </p>
                    <Badge variant="secondary" className={statusColors["active"]}>
                      active
                    </Badge>
                  </div>
                  <p title={member.email} className="text-xs text-card-foreground/60 truncate max-w-[20ch]">
                    {member.email}
                  </p>
                  <p className="text-xs text-card-foreground/60 capitalize">
                    {member.role}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 sm:shrink-0">
                {member.joined && (
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-card-foreground/60">Joined</p>
                    <p className="text-sm text-card-foreground">
                      {new Date(member.joined).toLocaleDateString()}
                    </p>
                  </div>
                )}
                <div className="flex items-center gap-1 text-sm text-card-foreground">
                  <Clock className="h-3 w-3" />
                  {member.hours}h/week
                </div>
              </div>
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
          profile?.role === "customer" && selectedDeveloper?.developerType === "internal"
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
