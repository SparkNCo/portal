"use client";

import { Header } from "@/components/headerDashboard";
import { ProgressPieChart } from "@/components/client/progress-pie-chart";
import { PriorityTasks } from "@/components/client/priority-tasks";
import { CreateIssue } from "@/components/shared/create-issue";
import { CardTitle } from "@/components/ui/card";
import { useSearchParams } from "next/navigation";
import { LoadingDataPanel } from "@/components/loader";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

async function fetchIssues(projectId: string) {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_ENDPOINT}/issues/?projectIds=${projectId}`,
  );

  if (!res.ok) throw new Error("Failed to fetch issues");
  return res.json();
}

export function useIssues(projectId: string | null) {
  const hasRefetched = useRef(false);

  const query = useQuery({
    queryKey: ["linear-issues", projectId],
    queryFn: () => fetchIssues(projectId!),
    enabled: !!projectId,
   // staleTime: 3_000,
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
  const searchParams = useSearchParams();
  const projects = searchParams.get("projects");

  const { data, isLoading, isFetching } = useIssues(projects);

  if (isLoading) return <LoadingDataPanel />;

  return (
    <div className="min-h-screen">
      <Header title="Client Dashboard" subtitle="Welcome back, John" />
      <CardTitle
        className="text-base font-semibold flex items-center gap-2"
        onClick={() => console.log({ projects: projects })}
      >
        Ver data
        {isFetching && (
          <span className="text-xs text-muted-foreground ml-2">Updating…</span>
        )}
      </CardTitle>

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
