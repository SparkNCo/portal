"use client";

import { useState } from "react";
import { useUser } from "../../../context/UserContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import AddDeveloperModal from "./AddDeveloperModal";
import AddClientModal from "./AddClientModal";
import AssignCustomerModal from "./AssignCustomerModal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/components/ui/button";
import {
  Users,
  UserPlus,
  UserCheck,
  ChevronDown,
  ChevronUp,
  Search,
} from "lucide-react";

type User = {
  id: string;
  email: string;
  userName?: string;
  role: "admin" | "developer" | "customer";
};

const roleColors: Record<string, string> = {
  admin: "bg-chart-1/20 text-chart-1",
  developer: "bg-chart-2/20 text-chart-2",
  customer: "bg-chart-3/20 text-chart-3",
};

function getInitials(email: string) {
  return email.slice(0, 2).toUpperCase();
}

export default function AdminUsersPage() {
  const { profile, loading } = useUser();
  const queryClient = useQueryClient();

  const [showAddDevModal, setShowAddDevModal] = useState(false);
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<string>("");
  const [assigningUserId, setAssigningUserId] = useState<string | null>(null);
  const [expandedUser, setExpandedUser] = useState<User | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string | null>(null);

  const { data: developerAssignments, isLoading: developerAssignmentsLoading } =
    useQuery({
      queryKey: ["developer-assignments", expandedUser?.id],
      enabled: !!expandedUser?.id && expandedUser.role === "developer",
      queryFn: async () => {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_ENDPOINT}/assignments?developer=${expandedUser!.id}`,
          {
            headers: {
              Authorization: `Bearer ${process.env.NEXT_PUBLIC_APIKEY}`,
              apikey: process.env.NEXT_PUBLIC_APIKEY!,
              "Content-Type": "application/json",
            },
          },
        );
        const data = await res.json();
        return data;
      },
    });

  const { data: customerAssignments, isLoading: customerAssignmentsLoading } =
    useQuery({
      queryKey: ["customer-assignments", expandedUser?.id],
      enabled: !!expandedUser?.id && expandedUser.role === "customer",
      queryFn: async () => {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_ENDPOINT}/assignments?customer_id=${expandedUser!.id}`,
          {
            headers: {
              Authorization: `Bearer ${process.env.NEXT_PUBLIC_APIKEY}`,
              apikey: process.env.NEXT_PUBLIC_APIKEY!,
              "Content-Type": "application/json",
            },
          },
        );
        const data = await res.json();
        return data;
      },
    });

  const userAssignments =
    expandedUser?.role === "customer"
      ? customerAssignments
      : developerAssignments;
  const assignmentsLoading =
    expandedUser?.role === "customer"
      ? customerAssignmentsLoading
      : developerAssignmentsLoading;

  const {
    data: users = [],
    isLoading: usersLoading,
    error,
  } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const res = await fetch(`${process.env.NEXT_PUBLIC_ENDPOINT}/users`, {
        headers: {
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_APIKEY}`,
          apikey: process.env.NEXT_PUBLIC_APIKEY!,
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) throw new Error("Failed to fetch users");

      return res.json();
    },
  });

  const customers = users.filter((u: User) => u.role === "customer");

  const filteredUsers = users.filter((u: User) => {
    if (roleFilter && u.role !== roleFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return u.email?.toLowerCase().includes(q) || u.userName?.toLowerCase().includes(q);
    }
    return true;
  });

  const { mutate: assignUser, isPending: assigning } = useMutation({
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
            user_id: assigningUserId,
            customer_id: selectedCustomer,
          }),
        },
      );

      if (!res.ok) throw new Error("Failed to assign user");

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setAssigningUserId(null);
      setSelectedCustomer("");
    },
  });

  if (loading || !profile?.role) {
    return (
      <div className="h-screen flex items-center justify-center text-muted-foreground">
        Loading...
      </div>
    );
  }

  if (profile.role !== "admin") {
    return (
      <div className="h-screen flex items-center justify-center text-destructive">
        Not authorized
      </div>
    );
  }

  if (usersLoading) {
    return (
      <div className="h-screen flex items-center justify-center text-muted-foreground">
        Loading users...
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center text-destructive">
        Error loading users
      </div>
    );
  }

  return (
    <div className="p-6">
      {showAddDevModal && (
        <AddDeveloperModal onClose={() => setShowAddDevModal(false)} />
      )}
      {showAddCustomerModal && (
        <AddClientModal onClose={() => setShowAddCustomerModal(false)} />
      )}
      {assigningUserId && (
        <AssignCustomerModal
          userId={assigningUserId}
          customers={customers}
          onClose={() => setAssigningUserId(null)}
        />
      )}

      <Card className="bg-background border-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Users className="h-4 w-4 text-accent" />
              Users
            </CardTitle>

            <div className="flex items-center gap-2 bg-background">
              <Button
                size="sm"
                variant="outline"
                className="gap-1"
                onClick={() => setShowAddDevModal(true)}
              >
                <UserPlus className="h-4 w-4" />
                Add Developer
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1"
                onClick={() => setShowAddCustomerModal(true)}
              >
                <UserPlus className="h-4 w-4" />
                Add Customer
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                placeholder="Search by email or username..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-md border border-border bg-background pl-8 pr-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div className="flex gap-1.5">
              {(["admin", "developer", "customer"] as const).map((role) => (
                <button
                  key={role}
                  onClick={() => setRoleFilter(roleFilter === role ? null : role)}
                  className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-all ${
                    roleFilter === role
                      ? `${roleColors[role]} border-current`
                      : "bg-muted/40 text-muted-foreground border-border hover:bg-muted"
                  }`}
                >
                  {role}
                </button>
              ))}
            </div>
          </div>

          {filteredUsers.length === 0 && (
            <div className="text-center py-8">
              <Users className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No users found</p>
            </div>
          )}

          <div className="space-y-2">
            {filteredUsers.map((u: User) => {
              const isExpanded = expandedUser?.id === u.id;

              return (
                <div
                  key={u.id}
                  className="rounded-lg border border-border bg-secondary/30 transition-colors group"
                >
                  {/* Row */}
                  <div className="flex items-center justify-between p-3 hover:bg-secondary/50">
                    {/* Left */}
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/20 text-sm font-medium text-accent">
                        {getInitials(u.email)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-card-foreground group-hover:text-accent transition-colors">
                          {u.email}
                        </p>
                        <Badge
                          variant="secondary"
                          className={
                            roleColors[u.role] ?? "bg-muted text-foreground"
                          }
                        >
                          {u.role}
                        </Badge>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                        {u.role === "developer" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 gap-1 text-xs"
                            onClick={() => setAssigningUserId(u.id)}
                          >
                            <UserCheck className="h-4 w-4" />
                            Assign
                          </Button>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setExpandedUser(isExpanded ? null : u)}
                      >
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Expanded panel */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-3 border-t border-border">
                      {assignmentsLoading && (
                        <p className="text-sm text-muted-foreground animate-pulse">
                          Loading...
                        </p>
                      )}
                      {!assignmentsLoading && userAssignments?.length === 0 && (
                        <p className="text-sm text-muted-foreground">
                          No assignments found
                        </p>
                      )}

                      {!assignmentsLoading && userAssignments?.length > 0 && (
                        <div className="space-y-2">
                          {expandedUser?.role === "customer"
                            ? userAssignments.map((a: any) => (
                                <div
                                  key={a.id}
                                  className="flex items-center justify-between rounded-lg border border-border bg-secondary/20 px-3 py-2 text-sm"
                                >
                                  <div className="flex items-center gap-3">
                                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent/20 text-xs font-medium text-accent">
                                      {a.email?.slice(0, 2).toUpperCase()}
                                    </div>
                                    <div>
                                      <p className="font-medium text-card-foreground">
                                        {a.email}
                                      </p>
                                      <p className="text-xs text-muted-foreground capitalize">
                                        {a.role}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                    {a.joined && (
                                      <span>
                                        Joined{" "}
                                        {new Date(
                                          a.joined,
                                        ).toLocaleDateString()}
                                      </span>
                                    )}
                                    {a.allocation && (
                                      <span className="font-medium text-foreground">
                                        {a.allocation}h/week
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ))
                            : userAssignments.map((a: any) => (
                                <div
                                  key={a.id}
                                  className="flex items-center justify-between rounded-lg border border-border bg-secondary/20 px-3 py-2 text-sm"
                                >
                                  <div className="flex items-center gap-3">
                                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent/20 text-xs font-medium text-accent">
                                      {a.customer_email
                                        ?.slice(0, 2)
                                        .toUpperCase()}
                                    </div>
                                    <div>
                                      <p className="font-medium text-card-foreground">
                                        {a.customer_email}
                                      </p>
                                      <p className="text-xs text-muted-foreground capitalize">
                                        Customer
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                    {a.joined && (
                                      <span>
                                        Joined{" "}
                                        {new Date(
                                          a.joined,
                                        ).toLocaleDateString()}
                                      </span>
                                    )}
                                    <span className="font-medium text-foreground">
                                      {a.allocation}h/week
                                    </span>
                                  </div>
                                </div>
                              ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
