"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Plus, Clock } from "lucide-react";
import { Button } from "../components/ui/button";
import { useUser } from "context/UserContext";
import { API_JSON_HEADERS } from "@/lib/api-headers";

const statusColors = {
  active: "bg-success/20 text-success",
  pending: "bg-warning/20 text-warning",
  inactive: "bg-muted text-muted-foreground",
};

export function StaffingSection({ customerId }: { readonly customerId?: string }) {
  const { user, profile, loading } = useUser();

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
    skills: [],
  }));

  const totalHours = teamMembers.reduce(
    (sum: number, m: any) => sum + m.hours,
    0,
  );

  return (
    <Card className="bg-background border-border">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Users className="h-4 w-4 text-accent" />
          Team Members
        </CardTitle>

        {/* 🔥 cal.com button */}
        <Button
          size="sm"
          className="bg-accent text-accent-foreground hover:bg-accent/90"
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
      </CardHeader>

      <CardContent>
        <div className="space-y-3">
          {teamMembers.map((member: any, i: number) => (
            <div
              key={i}
              className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg border border-border bg-secondary/30 p-4"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/20 text-sm font-medium text-accent">
                  {member.avatar}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p title={member.name} className="text-sm font-medium text-background-foreground truncate max-w-[15ch]">
                      {member.name}
                    </p>
                    <Badge variant="secondary" className={statusColors["active"]}>
                      active
                    </Badge>
                  </div>
                  <p title={member.email} className="text-xs text-muted-foreground truncate max-w-[20ch]">
                    {member.email}
                  </p>
                  <p className="text-xs text-muted-foreground capitalize">
                    {member.role}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 sm:shrink-0">
                {member.joined && (
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-muted-foreground">Joined</p>
                    <p className="text-sm text-background-foreground">
                      {new Date(member.joined).toLocaleDateString()}
                    </p>
                  </div>
                )}
                <div className="flex items-center gap-1 text-sm text-background-foreground">
                  <Clock className="h-3 w-3" />
                  {member.hours}h/week
                </div>
              </div>
            </div>
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
    </Card>
  );
}
