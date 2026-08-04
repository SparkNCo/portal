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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Users,
  UserCheck,
  ChevronDown,
  ChevronUp,
  Search,
  FolderKanban,
  Pencil,
  Eye,
  Mail,
  Plus,
} from "lucide-react";
import { API_JSON_HEADERS } from "@/lib/api-headers";
import { supabase } from "@/lib/supabase-client";
import { Header } from "@/components/headerDashboard";

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
  const [assigningUserRole, setAssigningUserRole] =
    useState<string>("developer");
  const [editingProfileUser, setEditingProfileUser] = useState<User | null>(
    null,
  );
  const [viewingProfileUser, setViewingProfileUser] = useState<User | null>(
    null,
  );
  const [expandedUser, setExpandedUser] = useState<User | null>(null);
  const [search, setSearch] = useState("");

  const {
    data: users = [],
    isLoading: usersLoading,
    error,
  } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/users`,
        {
          headers: apiHeaders,
        },
      );
      if (!res.ok) throw new Error("Failed to fetch users");
      return res.json();
    },
  });

  const customers: User[] = users.filter((u: User) => u.role === "customer");

  const customerIds = customers.map((c) => c.id);

  // `/functions/v1/users` (plain) doesn't join `clientName` — only
  // `?type=customers` does. Needed for the Projects view's group titles.
  const { data: customerDetails = [] } = useQuery<
    { id: string; clientName: string | null }[]
  >({
    queryKey: ["customers"],
    queryFn: async () => {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/users?type=customers`,
        { headers: apiHeaders },
      );
      if (!res.ok) throw new Error("Failed to fetch customers");
      return res.json();
    },
    enabled: customerIds.length > 0,
  });

  const initiativeNameByCustomerId = new Map(
    customerDetails.map((c) => [c.id, c.clientName]),
  );

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

  // ── Developer assignments (expanded user panel) ── only developer rows
  // can expand, so this only ever fires for that role.
  const { data: developerAssignments, isLoading: developerAssignmentsLoading } =
    useQuery({
      queryKey: ["developer-assignments", expandedUser?.id],
      enabled: !!expandedUser?.id && expandedUser.role === "developer",
      queryFn: async () => {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/assignments?developer=${expandedUser!.id}`,
          { headers: apiHeaders },
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

  const filteredUsers = users.filter((u: User) => {
    if (search) {
      const q = search.toLowerCase();
      return (
        u.email?.toLowerCase().includes(q) ||
        u.userName?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const ROLES = ["admin", "developer", "customer", "stakeholder"] as const;

  // No "add admin" flow exists — admins are created outside this UI, so that
  // role never gets an add box.
  const addHandlersByRole: Partial<Record<(typeof ROLES)[number], () => void>> = {
    developer: () => setShowAddDevModal(true),
    customer: () => setShowAddCustomerModal(true),
    stakeholder: () => setShowAddStakeholderModal(true),
  };

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
    variables: resendingVariables,
  } = useMutation({
    mutationFn: async ({
      user,
      emailType,
    }: {
      user: User;
      emailType: "invite" | "reset";
    }) => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/users?type=resend-account-email`,
        {
          method: "POST",
          headers: {
            ...apiHeaders,
            Authorization: `Bearer ${session?.access_token ?? ""}`,
          },
          body: JSON.stringify({ id: user.id, emailType }),
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Failed to resend account email");
      }
      return res.json();
    },
    onSuccess: (_data, { user, emailType }) => {
      toast.success(
        emailType === "reset"
          ? `Password reset email sent to ${user.email}`
          : `Invite email resent to ${user.email}`,
      );
    },
    onError: (err: any, { user }) => {
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
    <div className="min-h-screen">
      <Header title="Admin Panel" subtitle="Manage users and settings" />
      <div className="sm:px-6 py-6 space-y-4 ">
      {showAddDevModal && (
        <AddDeveloperModal onClose={() => setShowAddDevModal(false)} />
      )}
      {showAddCustomerModal && (
        <AddClientModal onClose={() => setShowAddCustomerModal(false)} />
      )}
      {showAddStakeholderModal && (
        <AddStakeholderModal
          onClose={() => setShowAddStakeholderModal(false)}
        />
      )}
      {assigningUserId && (
        <AssignCustomerModal
          userId={assigningUserId}
          userRole={assigningUserRole}
          customers={customers}
          onClose={() => {
            setAssigningUserId(null);
            setAssigningUserRole("developer");
          }}
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
      <div className="flex items-center">
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
      </div>

      {/* ── Users view ── */}
      {view === "users" && (
        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              aria-label="Search by email or username"
              placeholder="Search by email or username..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-md border border-border bg-background pl-8 pr-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          {/* One panel per role — only developer rows can expand to show assignments */}
          {ROLES.map((role) => {
            const roleUsers = filteredUsers.filter(
              (u: User) => u.role === role,
            );
            return (
              <Card key={role} className="bg-background border-border">
                <CardHeader>
                  <CardTitle className="text-base font-semibold flex items-center gap-2 capitalize">
                    <Users className="h-4 w-4 text-accent" />
                    {role}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {roleUsers.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">
                      No {role}s found
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {roleUsers.map((u: User) => {
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
                                    className="text-sm font-medium text-card-foreground group-hover:text-accent transition-colors truncate"
                                  >
                                    {u.email}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-1">
                                <div className="flex sm:hidden sm:group-hover:flex sm:group-focus-within:flex items-center gap-1">
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
                                  {(u.role === "developer" ||
                                    u.role === "stakeholder") && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-8 gap-1 text-xs"
                                      onClick={() => {
                                        setAssigningUserId(u.id);
                                        setAssigningUserRole(u.role);
                                      }}
                                    >
                                      <UserCheck className="h-4 w-4" />
                                      Assign
                                    </Button>
                                  )}
                                </div>
                                {/* Kept outside the hover-only wrapper above —
                                    while its (portaled) menu is open, moving the
                                    mouse toward it leaves the row's bounding box,
                                    which would flip this trigger to display:none
                                    mid-interaction and throw off its position. */}
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      title="Resend account email"
                                      aria-label="Resend account email"
                                      disabled={
                                        resendPending &&
                                        resendingVariables?.user.id === u.id
                                      }
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <Mail
                                        className={`h-4 w-4 ${resendPending && resendingVariables?.user.id === u.id ? "animate-pulse" : ""}`}
                                      />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent
                                    align="end"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <DropdownMenuItem
                                      onClick={() =>
                                        resendAccountEmail({
                                          user: u,
                                          emailType: "invite",
                                        })
                                      }
                                    >
                                      Resend invite
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() =>
                                        resendAccountEmail({
                                          user: u,
                                          emailType: "reset",
                                        })
                                      }
                                    >
                                      Send password reset
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                                {u.role === "developer" && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() =>
                                      setExpandedUser(isExpanded ? null : u)
                                    }
                                  >
                                    {isExpanded ? (
                                      <ChevronUp className="h-4 w-4" />
                                    ) : (
                                      <ChevronDown className="h-4 w-4" />
                                    )}
                                  </Button>
                                )}
                              </div>
                            </div>

                            {isExpanded && u.role === "developer" && (
                              <div className="px-4 pb-4 pt-3 border-t border-border">
                                {developerAssignmentsLoading && (
                                  <p className="text-sm text-muted-foreground animate-pulse">
                                    Loading...
                                  </p>
                                )}
                                {!developerAssignmentsLoading &&
                                  developerAssignments?.length === 0 && (
                                    <p className="text-sm text-muted-foreground">
                                      No assignments found
                                    </p>
                                  )}
                                {!developerAssignmentsLoading &&
                                  developerAssignments?.length > 0 && (
                                    <div className="space-y-2">
                                      {developerAssignments.map((a: any) => {
                                        const initiativeName =
                                          a.clientName ?? a.customer_email;
                                        return (
                                          <div
                                            key={a.id}
                                            className="flex items-center justify-between rounded-lg border border-border bg-secondary/20 px-3 py-2 text-sm"
                                          >
                                            <div className="flex items-center gap-3 min-w-0">
                                              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/20 text-xs font-medium text-accent">
                                                {initiativeName
                                                  ?.slice(0, 2)
                                                  .toUpperCase()}
                                              </div>
                                              <div className="min-w-0">
                                                <p
                                                  title={initiativeName}
                                                  className="font-medium text-card-foreground truncate"
                                                >
                                                  {initiativeName}
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
                                        );
                                      })}
                                    </div>
                                  )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {addHandlersByRole[role] && (
                    <button
                      type="button"
                      onClick={addHandlersByRole[role]}
                      className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-3 text-sm text-muted-foreground hover:border-accent hover:text-accent transition-colors"
                      aria-label={`Add ${role}`}
                    >
                      <Plus className="h-4 w-4" />
                      Add {role}
                    </button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
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
                {Object.values(projectsMap).map(({ customer, developers }) => {
                  const initiativeName =
                    initiativeNameByCustomerId.get(customer.id) ??
                    customer.email;
                  return (
                    <div
                      key={customer.id}
                      className="rounded-lg border border-border bg-secondary/30"
                    >
                      {/* Initiative header */}
                      <div className="flex items-center gap-3 p-3 border-b border-border">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-chart-3/20 text-sm font-medium text-chart-3">
                          {initiativeName.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p
                            title={initiativeName}
                            className="text-sm font-semibold text-card-foreground truncate"
                          >
                            {initiativeName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {developers.length === 0
                              ? "No assignees"
                              : `${developers.length} assignee${developers.length > 1 ? "s" : ""}`}
                          </p>
                        </div>
                      </div>

                      {/* Members: customer first, then stakeholders, then developers */}
                      {(() => {
                        const stakeholders = developers.filter(
                          (a) => a.role === "stakeholder",
                        );
                        const devs = developers.filter(
                          (a) => a.role === "developer",
                        );
                        const members = [
                          {
                            key: customer.id,
                            email: customer.email,
                            role: "customer",
                            joined: undefined as string | undefined,
                            allocation: undefined as number | undefined,
                          },
                          ...stakeholders.map((a) => ({
                            key: a.user_id,
                            email: a.email,
                            role: a.role,
                            joined: a.joined,
                            allocation: a.allocation,
                          })),
                          ...devs.map((a) => ({
                            key: a.user_id,
                            email: a.email,
                            role: a.role,
                            joined: a.joined,
                            allocation: a.allocation,
                          })),
                        ];

                        return (
                          <div className="divide-y divide-border">
                            {members.map((m) => (
                              <div
                                key={m.key}
                                className="flex items-center justify-between px-4 py-2.5 text-sm"
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-chart-2/20 text-xs font-medium text-chart-2">
                                    {m.email?.slice(0, 2).toUpperCase()}
                                  </div>
                                  <div className="min-w-0">
                                    <p
                                      title={m.email}
                                      className="font-medium text-card-foreground truncate"
                                    >
                                      {m.email}
                                    </p>
                                    <p className="text-xs text-muted-foreground capitalize">
                                      {m.role}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                  {m.joined && (
                                    <span>
                                      Joined{" "}
                                      {new Date(m.joined).toLocaleDateString()}
                                    </span>
                                  )}
                                  {m.role === "developer" && m.allocation && (
                                    <span className="font-medium text-foreground">
                                      {m.allocation}h/week
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}
      </div>
    </div>
  );
}
