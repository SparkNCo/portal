"use client";

import { Header } from "@/components/headerDashboard";
import { ProgressPieChart } from "@/components/client/progress-pie-chart";
import { PriorityTasks } from "@/components/client/priority-tasks";
import { LoadingDataPanel } from "@/components/loader";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { CreateIssue } from "@/components/shared/create-issue";
import { useUser } from "context/UserContext";

async function fetchIssues(slug: string) {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_ENDPOINT}/issues/?linear_slug=${slug}`,
  );

  if (!res.ok) throw new Error("Failed to fetch issues");
  return res.json();
}

export function useIssues(slug: string | null) {
  const hasRefetched = useRef(false);

  const query = useQuery({
    queryKey: ["linear-issues", slug],
    queryFn: () => fetchIssues(slug!),
    enabled: !!slug,
  });

  useEffect(() => {
    if (!query.isLoading && !hasRefetched.current) {
      hasRefetched.current = true;

      const id = setTimeout(() => {
        query.refetch();
      }, 3_000);
      return () => clearTimeout(id);
    }
  }, [query.isLoading, query.refetch]);

  return query;
}

export default function ClientDashboard() {
  const { profile } = useUser();
  const slug = profile?.linear_slug ?? "";
  const { data, isLoading } = useIssues(slug);

  if (isLoading) return <LoadingDataPanel />;

  return (
    <div className="min-h-screen">
      <Header title="Client Dashboard" subtitle={`Welcome back, ${profile?.email ?? "User"}`} />
      {isLoading ? (
        <LoadingDataPanel />
      ) : (
        <div className="p-4 md:p-6 space-y-6">
          <div className="grid gap-4 md:gap-6 grid-cols-1 md:grid-cols-[300px_1fr] lg:grid-cols-[320px_1fr]">
            <ProgressPieChart issuesData={data ?? []} />
            <PriorityTasks issuesData={data ?? []} />
          </div>

          <CreateIssue />
        </div>
      )}
    </div>
  );
}
