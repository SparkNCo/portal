"use client";

import { Suspense, useEffect } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useUser } from "context/UserContext";
import { Header } from "@/components/headerDashboard";
import { LoadingDataPanel } from "@/components/loader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { User } from "lucide-react";
import { CustomerSlugProvider } from "context/CustomerSlugContext";
import ClientDashboard from "../client/page";
import RoadmapPage from "../roadmap/page";
import DeveloperPage from "../developer/page";
import DocumentsPage from "../documents/page";
import SettingsPage from "../settings/page";

type CustomerSummary = {
  userName: string;
  linear_slug: string;
  email: string;
};

function PanelRenderer({ panel }: { readonly panel: string }) {
  switch (panel) {
    case "roadmap":   return <RoadmapPage />;
    case "developer": return <DeveloperPage />;
    case "documents": return <DocumentsPage />;
    case "settings":  return <SettingsPage />;
    default:          return <ClientDashboard />;
  }
}

function DashboardsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { profile, loading } = useUser();
  const customer = searchParams.get("customer");
  const panel = searchParams.get("panel") ?? "client";

  const { data: customers, isLoading } = useQuery<CustomerSummary[]>({
    queryKey: ["customers"],
    queryFn: async () => {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_ENDPOINT}/users?type=customers`,
        {
          headers: {
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_APIKEY}`,
            apikey: process.env.NEXT_PUBLIC_APIKEY!,
            "Content-Type": "application/json",
          },
        },
      );
      if (!res.ok) throw new Error("Failed to fetch customers");
      return res.json();
    },
    enabled: profile?.role === "admin",
  });

  useEffect(() => {
    if (!loading && profile?.role !== "admin") {
      router.replace(`/${profile?.userName}/dashboard/client`);
    }
  }, [loading, profile, router]);

  if (loading || profile?.role !== "admin") return <LoadingDataPanel />;

  if (customer) {
    return (
      <CustomerSlugProvider value={customer}>
        <PanelRenderer panel={panel} />
      </CustomerSlugProvider>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <Header title="Dashboards" subtitle="All customer dashboards" />
        <p className="p-6 text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header title="Dashboards" subtitle="All customer dashboards" />
      {customers?.length ? (
        <div className="p-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {customers.map((c) => (
            <Link
              key={c.email}
              href={`dashboards?customer=${c.linear_slug}&panel=client`}
            >
              <Card className="bg-background border-border hover:border-accent transition-colors cursor-pointer">
                <CardHeader className="flex flex-row items-center gap-3 pb-2">
                  <div className="h-8 w-8 rounded-full bg-accent/20 flex items-center justify-center">
                    <User className="h-4 w-4 text-accent" />
                  </div>
                  <CardTitle className="text-sm font-semibold">
                    {c.userName || "—"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground space-y-0.5">
                  <p>{c.email}</p>
                  <p className="text-xs">Slug: {c.linear_slug}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <p className="p-6 text-sm text-muted-foreground">
          There are no customer dashboards created to show.
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
