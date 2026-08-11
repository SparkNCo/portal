"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useUser } from "context/UserContext";
import { Header } from "@/components/headerDashboard";
import { LoadingDataPanel } from "@/components/loader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, User } from "lucide-react";
import { API_JSON_HEADERS } from "@/lib/api-headers";
import AddClientModal from "@/app/admin/users/AddClientModal";

type CustomerSummary = {
  clientName: string;
  linear_slug: string;
  email: string;
};

type DeveloperAssignment = {
  id: string;
  customer_id: string;
  customer_email: string;
  linear_slug: string;
  clientName: string;
  allocation: number;
  joined: string;
};

function CustomerCard({
  basePath,
  isAdmin,
  email,
  clientName,
  linear_slug,
}: {
  readonly basePath: string;
  readonly isAdmin: boolean;
  readonly email: string;
  readonly clientName: string;
  readonly linear_slug: string;
}) {
  // Admins adopt the customer's own routes wholesale (same URL a customer
  // would see, e.g. /lualink/dashboard) instead of a nested admin-only path —
  // developers viewing an assigned customer still go through `basePath`
  // (the older nested `/{devSlug}/dashboards/[customer]/[panel]` flow).
  const href = isAdmin
    ? `/${encodeURIComponent(clientName.toLowerCase())}/dashboard`
    : `${basePath}/${encodeURIComponent(clientName.toLowerCase())}/dashboard`;

  return (
    <Link href={href}>
      <Card className="bg-card/75 hover:bg-card/50 border-border transition-all duration-150 hover:shadow-md hover:-translate-y-0.5">
        <CardHeader className="flex flex-row items-center gap-3 pb-2">
          <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
            <User className="h-4 w-4 text-primary" />
          </div>
          <CardTitle className="text-sm font-semibold">
            {clientName || "—"}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-card-foreground/60 space-y-0.5">
          <p>{email}</p>
          <p className="text-xs">Slug: {linear_slug}</p>
        </CardContent>
      </Card>
    </Link>
  );
}

function AddCustomerCard({ onClick }: { readonly onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[104px] items-center justify-center rounded-lg border border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary transition-colors"
      aria-label="Add Customer"
    >
      <Plus className="h-6 w-6 text-primary" />
    </button>
  );
}

// `basePath` is the route prefix for a customer's dashboard link — e.g.
// `/{slug}/dashboards` for developers viewing their assigned customers, or
// `/admin/dashboards` for admins.
export function DashboardsContent({ basePath }: { readonly basePath: string }) {
  const { profile, loading } = useUser();
  const queryClient = useQueryClient();
  const [showAddCustomer, setShowAddCustomer] = useState(false);

  const isAdmin = profile?.role === "admin";
  const isDeveloper = profile?.role === "developer";

  // Admin: fetch all customers
  const { data: allCustomers, isLoading: customersLoading } = useQuery<
    CustomerSummary[]
  >({
    queryKey: ["customers"],
    queryFn: async () => {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/users?type=customers`,
        { headers: API_JSON_HEADERS },
      );
      if (!res.ok) throw new Error("Failed to fetch customers");
      return res.json();
    },
    enabled: isAdmin,
  });

  // Developer: fetch only their assigned customers
  const { data: assignments, isLoading: assignmentsLoading } = useQuery<
    DeveloperAssignment[]
  >({
    queryKey: ["developer-assignments", profile?.id],
    queryFn: async () => {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/assignments?developer=${profile!.id}`,
        { headers: API_JSON_HEADERS },
      );
      if (!res.ok) throw new Error("Failed to fetch assignments");
      return res.json();
    },
    enabled: isDeveloper && !!profile?.id,
  });

  if (loading) return <LoadingDataPanel />;

  const isLoading = isAdmin ? customersLoading : assignmentsLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <Header title="Dashboards" subtitle="Customer dashboards" />
        <LoadingDataPanel />
      </div>
    );
  }

  // Normalise both sources to a common shape
  const cards: CustomerSummary[] = isAdmin
    ? (allCustomers ?? [])
    : (assignments ?? [])
        .filter((a) => a.clientName)
        .map((a) => ({
          clientName: a.clientName,
          linear_slug: a.linear_slug,
          email: a.customer_email,
        }));

  return (
    <div className="min-h-screen">
      <Header
        title="Dashboards"
        subtitle={
          isAdmin ? "All customer dashboards" : "Your assigned dashboards"
        }
      />

      {cards.length || isAdmin ? (
        <div className="p-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((c) => (
            <CustomerCard
              key={c.clientName}
              basePath={basePath}
              isAdmin={isAdmin}
              email={c.email}
              clientName={c.clientName}
              linear_slug={c.linear_slug}
            />
          ))}
          {isAdmin && (
            <AddCustomerCard onClick={() => setShowAddCustomer(true)} />
          )}
        </div>
      ) : (
        <p className="p-6 text-sm text-muted-foreground">
          No dashboards assigned yet.
        </p>
      )}

      {showAddCustomer && (
        <AddClientModal
          onClose={() => {
            setShowAddCustomer(false);
            queryClient.invalidateQueries({ queryKey: ["customers"] });
          }}
        />
      )}
    </div>
  );
}
