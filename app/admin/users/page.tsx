"use client";

import { useState } from "react";
import { useUser } from "../../../context/UserContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import AddDeveloperModal from "./AddDeveloperModal";
import AddClientModal from "./AddClientModal";
import AddStakeholderModal from "./AddStakeholderModal";
import AssignCustomerModal from "./AssignCustomerModal";
import EditDeveloperProfileModal from "./EditDeveloperProfileModal";
import ViewDeveloperProfileModal from "./ViewDeveloperProfileModal";
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
  FolderKanban,
  Pencil,
  Eye,
  Mail,
} from "lucide-react";
import { API_JSON_HEADERS } from "@/lib/api-headers";

type User = {
  id: string;
  email: string;
  userName?: string;
  role: "admin" | "developer" | "customer" | "stakeholder";
};

type Assignment = {
  id: string;
  customer_id: string;
  user_id: string;
  email: string;
  role: string;
  allocation?: number;
  joined?: string;
};

const roleColors: Record<string, string> = {
  admin: "bg-chart-1/20 text-chart-1",
  developer: "bg-chart-2/20 text-chart-2",
  customer: "bg-chart-3/20 text-chart-3",
  stakeholder: "bg-purple-500/20 text-purple-500",
};

function getInitials(email: string) {
  return email.slice(0, 2).toUpperCase();
}

const apiHeaders = API_JSON_HEADERS;

export default function AdminUsersPage() {
  const { profile, loading } = useUser();
  const queryClient = useQueryClient();

  const [view, setView] = useState<"users" | "projects">("users");
  const [showAddDevModal, setShowAddDevModal] = useState(false);
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [showAddStakeholderModal, setShowAddStakeholderModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<string>("");
  const [assigningUserId, setAssigningUserId] = useState<string | null>(null);
  const [assigningUserRole, setAssigningUserRole] = useState<string>("developer");
  const [editingProfileUser, setEditingProfileUser] = useState<User | null>(null);
  const [viewingProfileUser, setViewingProfileUser] = useState<User | null>(null);
  const [expandedUser, setExpandedUser] = useState<User | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string | null>(null);

  const {
    data: users = [],
    isLoading: usersLoading,
    error,
  } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/users`, {
        headers: apiHeaders,
      });
      if (!res.ok) throw new Error("Failed to fetch users");
      return res.json();
    },
  });

  const customers: User[] = users.filter((u: User) => u.role === "customer");

  const customerIds = customers.map((c) => c.id);

  const { data: allAssignments = [], isLoading: allAssignmentsLoading } =
    useQuery({
      queryKey: ["all-assignments", customerIds],
      enabled: customerIds.length > 0,
      queryFn: async () => {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/assignments?customer_id=${customerIds.join(",")}`,
          { headers: apiHeaders },
        );
        if (!res.ok) throw new Error("Failed to fetch assignments");
        return res.json();
      },
    });

  // ── Developer assignments (expanded user panel) ──
  const { data: developerAssignments, isLoading: developerAssignmentsLoading } =
    useQuery({
      queryKey: ["developer-assignments", expandedUser?.id],
      enabled: !!expandedUser?.id && (expandedUser.role === "developer" || expandedUser.role === "stakeholder"),
      queryFn: async () => {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/assignments?developer=${expandedUser!.id}`,
          { headers: apiHeaders },
        );
        const data = await res.json();
        return data;
      },
    });

  // ── Customer assignments (expanded user panel) ──
  const { data: customerAssignments, isLoading: customerAssignmentsLoading } =
    useQuery({
      queryKey: ["customer-assignments", expandedUser?.id],
      enabled: !!expandedUser?.id && expandedUser.role === "customer",
      queryFn: async () => {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/assignments?customer_id=${expandedUser!.id}`,
          { headers: API_JSON_HEADERS },
        );
        const data = await res.json();
        return data;
      },
    });

  // Group assignments by customer_id for the Projects view
  const projectsMap = customers.reduce<
    Record<string, { customer: User; developers: Assignment[] }>
  >((acc, customer) => {
    acc[customer.id] = {
      customer,
      developers: allAssignments.filter(
        (a: Assignment) => a.customer_id === customer.id,
      ),
    };
    return acc;
  }, {});

  const userAssignments =
    expandedUser?.role === "customer"
      ? customerAssignments
      : developerAssignments; // used for both developer and stakeholder
  const assignmentsLoading =
    expandedUser?.role === "customer"
      ? customerAssignmentsLoading
      : developerAssignmentsLoading;

  const filteredUsers = users.filter((u: User) => {
    if (roleFilter && u.role !== roleFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        u.email?.toLowerCase().includes(q) ||
        u.userName?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const { mutate: assignUser } = useMutation({
    mutationFn: async () => {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/assignments`,
        {
          method: "POST",
          headers: apiHeaders,
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
      queryClient.invalidateQueries({ queryKey: ["all-assignments"] });
      setAssigningUserId(null);
      setSelectedCustomer("");
    },
  });

  const {
    mutate: resendAccountEmail,
    isPending: resendPending,
    variables: resendingUser,
  } = useMutation({
    mutationFn: async (user: User) => {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/users?type=resend-account-email`,
        {
          method: "POST",
          headers: apiHeaders,
          body: JSON.stringify({
            id: user.id,
            origin: globalThis.location.origin,
          }),
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Failed to resend account email");
      }
      return res.json();
    },
    onSuccess: (_data, user) => {
      toast.success(`Account email resent to ${user.email}`);
    },
    onError: (err: any, user) => {
      toast.error(err?.message ?? `Failed to resend email to ${user.email}`);
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
    <div className="sm:px-6 py-6 space-y-4 ">
      {showAddDevModal && (
        <AddDeveloperModal onClose={() => setShowAddDevModal(false)} />
      )}
      {showAddCustomerModal && (
        <AddClientModal onClose={() => setShowAddCustomerModal(false)} />
      )}
      {showAddStakeholderModal && (
        <AddStakeholderModal onClose={() => setShowAddStakeholderModal(false)} />
      )}
      {assigningUserId && (
        <AssignCustomerModal
          userId={assigningUserId}
          userRole={assigningUserRole}
          customers={customers}
          onClose={() => { setAssigningUserId(null); setAssigningUserRole("developer"); }}
        />
      )}
      {editingProfileUser && (
        <EditDeveloperProfileModal
          userId={editingProfileUser.id}
          userEmail={editingProfileUser.email}
          onClose={() => setEditingProfileUser(null)}
        />
      )}
      {viewingProfileUser && (
        <ViewDeveloperProfileModal
          userId={viewingProfileUser.id}
          userEmail={viewingProfileUser.email}
          userName={viewingProfileUser.userName}
          role={viewingProfileUser.role}
          onClose={() => setViewingProfileUser(null)}
        />
      )}

      {/* ── View toggle ── */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 p-1 rounded-lg bg-secondary/40 border border-border">
          <button
            onClick={() => setView("users")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
              view === "users"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            Users
          </button>
          <button
            onClick={() => setView("projects")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
              view === "projects"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <FolderKanban className="h-3.5 w-3.5" />
            Projects
          </button>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="gap-1"
            onClick={() => setShowAddDevModal(true)}
          >
            <UserPlus className="h-4 w-4" />
            <span className="hidden sm:inline">Add Developer</span>
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1"
            onClick={() => setShowAddCustomerModal(true)}
          >
            <UserPlus className="h-4 w-4" />
            <span className="hidden sm:inline">Add Customer</span>
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1"
            onClick={() => setShowAddStakeholderModal(true)}
          >
            <UserPlus className="h-4 w-4" />
            <span className="hidden sm:inline">Add Stakeholder</span>
          </Button>
        </div>
      </div>

      {/* ── Users view ── */}
      {view === "users" && (
        <Card className="bg-background border-border">
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Users className="h-4 w-4 text-accent" />
              Users
            </CardTitle>
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
                {(["admin", "developer", "customer", "stakeholder"] as const).map((role) => (
                  <button
                    key={role}
                    onClick={() =>
                      setRoleFilter(roleFilter === role ? null : role)
                    }
                    className={`text-xs px-3 py-1.5 rounded-md border font-medium transition-all ${
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
                    <div className="flex items-center justify-between p-3 hover:bg-secondary/50">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/20 text-sm font-medium text-accent">
                          {getInitials(u.email)}
                        </div>
                        <div className="min-w-0">
                          <p
                            title={u.email}
                            className="text-sm font-medium text-card-foreground group-hover:text-accent transition-colors truncate max-w-[15ch]"
                          >
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

                      <div className="flex items-center gap-1">
                        <div className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity flex items-center gap-1">
                          {u.role === "developer" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 gap-1 text-xs"
                              onClick={() => setViewingProfileUser(u)}
                            >
                              <Eye className="h-4 w-4" />
                              View Profile
                            </Button>
                          )}
                          {u.role === "developer" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 gap-1 text-xs"
                              onClick={() => setEditingProfileUser(u)}
                            >
                              <Pencil className="h-4 w-4" />
                              Edit Profile
                            </Button>
                          )}
                          {(u.role === "developer" || u.role === "stakeholder") && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 gap-1 text-xs"
                              onClick={() => { setAssigningUserId(u.id); setAssigningUserRole(u.role); }}
                            >
                              <UserCheck className="h-4 w-4" />
                              Assign
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title="Resend account validation email"
                            aria-label="Resend account validation email"
                            disabled={resendPending}
                            onClick={(e) => {
                              e.stopPropagation();
                              resendAccountEmail(u);
                            }}
                          >
                            <Mail
                              className={`h-4 w-4 ${resendPending && resendingUser?.id === u.id ? "animate-pulse" : ""}`}
                            />
                          </Button>
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

                    {isExpanded && (
                      <div className="px-4 pb-4 pt-3 border-t border-border">
                        {assignmentsLoading && (
                          <p className="text-sm text-muted-foreground animate-pulse">
                            Loading...
                          </p>
                        )}
                        {!assignmentsLoading &&
                          userAssignments?.length === 0 && (
                            <p className="text-sm text-muted-foreground">
                              No assignments found
                            </p>
                          )}
                        {!assignmentsLoading && userAssignments?.length > 0 && (
                          <div className="space-y-2">
                            {expandedUser?.role === "customer"
                              ? userAssignments.map((a: Assignment) => (
                                  <div
                                    key={a.user_id}
                                    className="flex items-center justify-between rounded-lg border border-border bg-secondary/20 px-3 py-2 text-sm"
                                  >
                                    <div className="flex items-center gap-3 min-w-0">
                                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/20 text-xs font-medium text-accent">
                                        {a.email?.slice(0, 2).toUpperCase()}
                                      </div>
                                      <div className="min-w-0">
                                        <p
                                          title={a.email}
                                          className="font-medium text-card-foreground truncate max-w-[15ch]"
                                        >
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
                                    <div className="flex items-center gap-3 min-w-0">
                                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/20 text-xs font-medium text-accent">
                                        {a.customer_email
                                          ?.slice(0, 2)
                                          .toUpperCase()}
                                      </div>
                                      <div className="min-w-0">
                                        <p
                                          title={a.customer_email}
                                          className="font-medium text-card-foreground truncate max-w-[15ch]"
                                        >
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
      )}

      {/* ── Projects view ── */}
      {view === "projects" && (
        <Card className="bg-background border-border">
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <FolderKanban className="h-4 w-4 text-accent" />
              Projects
            </CardTitle>
          </CardHeader>
          <CardContent>
            {allAssignmentsLoading && (
              <p className="text-sm text-muted-foreground animate-pulse">
                Loading projects...
              </p>
            )}

            {!allAssignmentsLoading && customers.length === 0 && (
              <div className="text-center py-8">
                <FolderKanban className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  No customers yet
                </p>
              </div>
            )}

            {!allAssignmentsLoading && (
              <div className="space-y-4">
                {Object.values(projectsMap).map(({ customer, developers }) => (
                  <div
                    key={customer.id}
                    className="rounded-lg border border-border bg-secondary/30"
                  >
                    {/* Customer header */}
                    <div className="flex items-center gap-3 p-3 border-b border-border">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-chart-3/20 text-sm font-medium text-chart-3">
                        {getInitials(customer.email)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p
                          title={customer.email}
                          className="text-sm font-semibold text-card-foreground truncate max-w-[15ch]"
                        >
                          {customer.email}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {developers.length === 0
                            ? "No assignees"
                            : `${developers.length} assignee${developers.length > 1 ? "s" : ""}`}
                        </p>
                      </div>
                    </div>

                    {/* Developers */}
                    {developers.length === 0 ? (
                      <p className="px-4 py-3 text-sm text-muted-foreground">
                        No developers assigned yet.
                      </p>
                    ) : (
                      <div className="divide-y divide-border">
                        {developers.map((dev) => (
                          <div
                            key={dev.user_id}
                            className="flex items-center justify-between px-4 py-2.5 text-sm"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-chart-2/20 text-xs font-medium text-chart-2">
                                {dev.email?.slice(0, 2).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <p
                                  title={dev.email}
                                  className="font-medium text-card-foreground truncate max-w-[15ch]"
                                >
                                  {dev.email}
                                </p>
                                <p className="text-xs text-muted-foreground capitalize">
                                  {dev.role}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              {dev.joined && (
                                <span>
                                  Joined{" "}
                                  {new Date(dev.joined).toLocaleDateString()}
                                </span>
                              )}
                              {dev.allocation && (
                                <span className="font-medium text-foreground">
                                  {dev.allocation}h/week
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
