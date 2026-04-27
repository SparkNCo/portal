"use client";

import { Header } from "@/components/headerDashboard";
import { ProgressPieChart } from "@/components/client/progress-pie-chart";
import { PriorityTasks } from "@/components/client/priority-tasks";
import { LoadingDataPanel } from "@/components/loader";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
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
  console.log("SLUG", slug);

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
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [onlyActive, setOnlyActive] = useState(false);

  const allIssues = data ?? [];
  const availableStatuses = Array.from(
    new Set(allIssues.map((i: any) => i.state?.name).filter(Boolean)),
  ) as string[];
  const hasCycles = allIssues.some((i: any) => i.cycle !== undefined);

  const filteredIssues = allIssues.filter((issue: any) => {
    if (onlyActive && issue.cycle && !issue.cycle.isActive) return false;
    if (selectedStatuses.length > 0 && (!issue.state?.name || !selectedStatuses.includes(issue.state.name))) return false;
    return true;
  });

  const filterState = {
    selectedStatuses,
    onlyActive,
    availableStatuses,
    hasCycles,
    onToggleStatus: (s: string) =>
      setSelectedStatuses((prev) =>
        prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
      ),
    onToggleActive: () => setOnlyActive((v) => !v),
    onClearFilters: () => { setSelectedStatuses([]); setOnlyActive(false); },
  };

  if (isLoading) return <LoadingDataPanel />;

  return (
    <div className="min-h-screen">
      <Header
        title="Client Dashboard"
        subtitle={`Welcome back, ${profile?.email ?? "User"}`}
      />
      <div className="p-4 md:p-6 space-y-6">
        <div className="grid gap-4 md:gap-6 grid-cols-1 md:grid-cols-[300px_1fr] lg:grid-cols-[320px_1fr]">
          <ProgressPieChart issuesData={filteredIssues} />
          <PriorityTasks issuesData={filteredIssues} filterState={filterState} />
        </div>

        <CreateIssue />
      </div>
    </div>
  );
}
