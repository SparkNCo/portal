"use client";

import { Header } from "@/components/headerDashboard";
import { QuickLinks } from "@/components/developer/quick-links";
import { ToolShortcuts } from "@/components/developer/tool-shortcuts";
import { PriorityTasks } from "@/components/client/priority-tasks";
import { CreateIssue } from "@/components/shared/create-issue";
import { LoadingDataPanel } from "@/components/loader";
import { useQuery } from "@tanstack/react-query";
import { useUser } from "context/UserContext";
import { fetchIssues } from "../client/page";

export default function DeveloperDashboard() {
  const { profile } = useUser();
  const userId = profile?.id;

  // Derive slugs from the enriched assignment_id objects already on profile
  const assignments: any[] = Array.isArray(profile?.assignment_id)
    ? (profile.assignment_id as any[])
    : [];
  const slugs: string[] = assignments
    .map((a) => a.clientName)
    .filter(Boolean);

  const { data: issuesData, isLoading: issuesLoading } = useQuery({
    queryKey: ["linear-issues-developer", slugs],
    queryFn: async () => {
      const results = await Promise.all(slugs.map((s) => fetchIssues(s)));
      return results.flat();
    },
    enabled: slugs.length > 0,
  });

  const { data: questionsData } = useQuery<{
    countByIssue: Record<string, number>;
  }>({
    queryKey: ["issue-questions", userId],
    queryFn: async () => {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_ENDPOINT}/issue-questions?user_id=${userId}`,
        {
          headers: {
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_APIKEY}`,
            apikey: process.env.NEXT_PUBLIC_APIKEY!,
          },
        },
      );
      if (!res.ok) throw new Error("Failed to fetch issue questions");
      return res.json();
    },
    enabled: !!userId,
  });

  const questionCounts = questionsData?.countByIssue ?? {};

  const allIssues: any[] = issuesData ?? [];
  const filteredIssues = [...allIssues].sort((a: any, b: any) => {
    return (questionCounts[b.id] ?? 0) - (questionCounts[a.id] ?? 0);
  });

  const noopFilterState = {
    selectedStatuses: [],
    onlyActive: false,
    availableStatuses: [],
    hasCycles: false,
    onToggleStatus: () => {},
    onToggleActive: () => {},
    onClearFilters: () => {},
  };

  if (issuesLoading) return <LoadingDataPanel />;

  return (
    <div className="min-h-screen">
      <Header title="Developer Dashboard" subtitle="Good morning, Developer" />

      <div className="p-4 md:p-6 space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
          <QuickLinks />
          <ToolShortcuts />
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
          <PriorityTasks
            issuesData={filteredIssues}
            filterState={noopFilterState}
            onOpenChat={() => {}}
            title="All Tasks"
            questionCounts={questionCounts}
          />
          {/* <DevTasks /> */}
        </div>

        <CreateIssue slug={slugs[0] ?? ""} projectId="" profile={profile} />
      </div>
    </div>
  );
}
