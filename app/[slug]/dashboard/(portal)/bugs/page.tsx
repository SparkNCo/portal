"use client";

import { Header } from "@/components/headerDashboard";
import { PriorityTasks } from "@/components/client/priority-tasks";
import { BugReportPanel } from "@/components/bugs/bug-report-panel";
import { LoadingDataPanel } from "@/components/loader";
import { EditIssueModal } from "@/components/build/edit-issue-modal";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useUser } from "context/UserContext";
import { useCustomerSlug } from "context/CustomerSlugContext";
import { fetchIssues } from "../client/page";
import type { Issue } from "@/components/client/issues.types";
import { PinButton } from "@/components/dashboard/pin-button";

export default function BugsPage() {
  const { profile } = useUser();
  const customerSlug = useCustomerSlug();
  const { slug: urlSlug } = useParams<{ slug: string }>();
  const slug = customerSlug ?? urlSlug ?? profile?.linear_slug ?? "";

  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedPriorities, setSelectedPriorities] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [editingIssue, setEditingIssue] = useState<Issue | null>(null);

  const { data: issuesData, isLoading: issuesLoading } = useQuery({
    queryKey: ["linear-issues", slug],
    queryFn: () => fetchIssues(slug),
    enabled: !!slug,
  });

  const allIssues: any[] = issuesData ?? [];

  const bugIssues = allIssues.filter((i: any) =>
    (i.labels?.nodes ?? []).some((l: any) => l.name?.toLowerCase() === "bug"),
  );

  const projects: { id: string; name: string }[] = Array.from(
    new Map(
      bugIssues
        .filter((i: any) => i.project?.id && i.project?.name)
        .map((i: any) => [
          i.project.id,
          { id: i.project.id, name: i.project.name },
        ]),
    ).values(),
  );

  const projectFiltered = selectedProject
    ? bugIssues.filter((i: any) => i.project?.id === selectedProject)
    : bugIssues;

  const availableStatuses = [
    ...new Set(projectFiltered.map((i: any) => i?.state?.name).filter(Boolean)),
  ] as string[];
  const availablePriorities = [
    ...new Set(projectFiltered.map((i: any) => i.priorityLabel).filter(Boolean)),
  ] as string[];

  const statusFiltered = selectedStatuses.length > 0
    ? projectFiltered.filter((i: any) => selectedStatuses.includes(i?.state?.name))
    : projectFiltered;

  const priorityFiltered = selectedPriorities.length > 0
    ? statusFiltered.filter((i: any) => selectedPriorities.includes(i.priorityLabel))
    : statusFiltered;

  const dateFiltered = priorityFiltered.filter((i: any) => {
    if (!i.createdAt) return true;
    const created = new Date(i.createdAt).getTime();
    if (dateFrom && created < new Date(dateFrom).getTime()) return false;
    if (dateTo && created > new Date(dateTo).getTime() + 24 * 60 * 60 * 1000 - 1) return false;
    return true;
  });

  const PRIORITY_RANK: Record<string, number> = {
    Urgent: 4,
    High: 3,
    Medium: 2,
    Low: 1,
  };

  const visibleIssues = useMemo(() => {
    return [...dateFiltered].sort((a: any, b: any) => {
      const rankA = PRIORITY_RANK[a.priorityLabel] ?? 0;
      const rankB = PRIORITY_RANK[b.priorityLabel] ?? 0;
      if (rankA !== rankB) return rankB - rankA;

      return (
        new Date(a.createdAt ?? 0).getTime() -
        new Date(b.createdAt ?? 0).getTime()
      );
    });
  }, [dateFiltered]);

  const filterState = {
    selectedStatuses,
    onlyActive: false,
    availableStatuses,
    hasCycles: false,
    onToggleStatus: (s: string) =>
      setSelectedStatuses((prev) =>
        prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
      ),
    onToggleActive: () => {},
    selectedPriorities,
    availablePriorities,
    onTogglePriority: (p: string) =>
      setSelectedPriorities((prev) =>
        prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p],
      ),
    dateFrom,
    dateTo,
    onDateFromChange: setDateFrom,
    onDateToChange: setDateTo,
    onClearFilters: () => {
      setSelectedStatuses([]);
      setSelectedPriorities([]);
      setDateFrom("");
      setDateTo("");
    },
  };

  return (
    <div className="min-h-screen">
      <Header title="Bugs" subtitle="Issues discovered in production" />

      <div className="p-4 md:p-6 space-y-6">
        <BugReportPanel slug={slug} />

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setSelectedProject(null)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
              selectedProject === null
                ? "bg-accent text-accent-foreground border-accent/40"
                : "border-border/40 text-muted-foreground hover:text-foreground hover:border-foreground/30"
            }`}
          >
            All Projects
          </button>
          {projects.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelectedProject(p.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                selectedProject === p.id
                  ? "bg-accent text-accent-foreground border-accent/40"
                  : "border-border/40 text-muted-foreground hover:text-foreground hover:border-foreground/30"
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>

        <div className="relative w-full max-w-full overflow-hidden">
          {issuesLoading ? (
            <LoadingDataPanel />
          ) : (
            <>
              <PinButton panelId="bugs_list" />
              <PriorityTasks
                issuesData={visibleIssues}
                filterState={filterState}
                onOpenChat={() => {}}
                onEditIssue={(issue) => setEditingIssue(issue)}
                title="Bugs"
              />
            </>
          )}
        </div>
      </div>

      {editingIssue && (
        <EditIssueModal
          issue={editingIssue}
          slug={slug}
          onClose={() => setEditingIssue(null)}
        />
      )}
    </div>
  );
}
