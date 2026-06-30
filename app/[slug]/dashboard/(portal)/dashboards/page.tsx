"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useUser } from "context/UserContext";
import { Header } from "@/components/headerDashboard";
import { LoadingDataPanel } from "@/components/loader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { User } from "lucide-react";
import { CustomerSlugProvider } from "context/CustomerSlugContext";
import ClientDashboard from "../client/page";
import RoadmapPage from "../roadmap/page";
import BuildPage from "../build/page";
import BugsPage from "../bugs/page";
import DeveloperPage from "../developer/page";
import DocumentsPage from "../documents/page";
import SettingsPage from "../settings/page";

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

const apiHeaders = {
  Authorization: `Bearer ${process.env.NEXT_PUBLIC_APIKEY}`,
  apikey: process.env.NEXT_PUBLIC_APIKEY!,
  "Content-Type": "application/json",
};

function PanelRenderer({ panel, slug }: { readonly panel: string; readonly slug: string }) {
  switch (panel) {
    case "roadmap":
      return <RoadmapPage />;
    case "build":
      return <BuildPage />;
    case "bugs":
      return <BugsPage />;
    case "developer":
      return <DeveloperPage />;
    case "documents":
      return <DocumentsPage />;
    case "settings":
      return <SettingsPage />;
    default:
      return <ClientDashboard />;
  }
}

function CustomerCard({
  email,
  clientName,
  linear_slug,
}: {
  readonly email: string;
  readonly clientName: string;
  readonly linear_slug: string;
}) {
  return (
    <Link href={`dashboards?customer=${clientName}&panel=client`}>
      <Card className="bg-background border-border hover:border-accent transition-colors cursor-pointer">
        <CardHeader className="flex flex-row items-center gap-3 pb-2">
          <div className="h-8 w-8 rounded-full bg-accent/20 flex items-center justify-center">
            <User className="h-4 w-4 text-accent" />
          </div>
          <CardTitle className="text-sm font-semibold">
            {clientName || "—"}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-0.5">
          <p>{email}</p>
          <p className="text-xs">Slug: {linear_slug}</p>
        </CardContent>
      </Card>
    </Link>
  );
}

function DashboardsContent() {
  const searchParams = useSearchParams();
  const { profile, loading } = useUser();
  const customer = searchParams.get("customer");
  const panel = searchParams.get("panel") ?? "client";

  const isAdmin = profile?.role === "admin";
  const isDeveloper = profile?.role === "developer";

  // Admin: fetch all customers
  const { data: allCustomers, isLoading: customersLoading } = useQuery<
    CustomerSummary[]
  >({
    queryKey: ["customers"],
    queryFn: async () => {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_ENDPOINT}/users?type=customers`,
        { headers: apiHeaders },
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
        `${process.env.NEXT_PUBLIC_ENDPOINT}/assignments?developer=${profile!.id}`,
        { headers: apiHeaders },
      );
      if (!res.ok) throw new Error("Failed to fetch assignments");
      return res.json();
    },
    enabled: isDeveloper && !!profile?.id,
  });

  // If a specific customer dashboard is selected, render it immediately
  // without waiting for the profile — ClientDashboard uses customerSlug from context
  if (customer) {
    return (
      <CustomerSlugProvider value={customer}>
        <PanelRenderer panel={panel} slug={customer} />
      </CustomerSlugProvider>
    );
  }

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

      {cards.length ? (
        <div className="p-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((c) => (
            <CustomerCard
              key={c.clientName}
              email={c.email}
              clientName={c.clientName}
              linear_slug={c.linear_slug}
            />
          ))}
        </div>
      ) : (
        <p className="p-6 text-sm text-muted-foreground">
          No dashboards assigned yet.
        </p>
      )}
    </div>
  );
}

export default function DashboardsPage() {
  return (
    <Suspense fallback={<LoadingDataPanel />}>
      <DashboardsContent />
    </Suspense>
  );
}
