"use client";

import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/headerDashboard";
import { LoadingDataPanel } from "@/components/loader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { User } from "lucide-react";

type CustomerSummary = {
  userName: string;
  linear_slug: string;
  email: string;
};

export default function DashboardsPage() {
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
  });

  if (isLoading) return <LoadingDataPanel />;

  return (
    <div className="min-h-screen">
      <Header title="Dashboards" subtitle="All customer dashboards" />
      <div className="p-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {customers?.map((c) => (
          <Card key={c.email} className="bg-background border-border">
            <CardHeader className="flex flex-row items-center gap-3 pb-2">
              <div className="h-8 w-8 rounded-full bg-accent/20 flex items-center justify-center">
                <User className="h-4 w-4 text-accent" />
              </div>
              <CardTitle className="text-sm font-semibold">
                {c.userName || "—"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm text-muted-foreground">
              <p>{c.email}</p>
              <p className="text-xs">Slug: {c.linear_slug}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
