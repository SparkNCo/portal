"use client";

import { Header } from "@/components/headerDashboard";
import { PriorityTasks } from "@/components/client/priority-tasks";
import { CreateIssue } from "@/components/shared/create-issue";
import { LoadingDataPanel } from "@/components/loader";
import { EditIssueModal } from "@/components/build/edit-issue-modal";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useParams } from "next/navigation";
import { useUser } from "context/UserContext";
import { useCustomerSlug } from "context/CustomerSlugContext";
import { fetchIssues } from "../client/page";
import type { Issue } from "@/components/client/issues.types";

export default function BuildPage() {
  const { profile } = useUser();
  const customerSlug = useCustomerSlug();
  const { slug: urlSlug } = useParams<{ slug: string }>();
  const slug = customerSlug ?? urlSlug ?? profile?.linear_slug ?? "";
  const linearSlug =
    profile?.linear_slug ||
    profile?.assignment_id?.find((a: any) => a.clientName === slug)
      ?.linear_slug ||
    "";

  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [selectedPriorities, setSelectedPriorities] = useState<string[]>([]);
  const [editingIssue, setEditingIssue] = useState<Issue | null>(null);
  const [sortBy, setSortBy] = useState<"updated" | "estimate">("updated");

  const { data: issuesData, isLoading: issuesLoading } = useQuery({
    queryKey: ["linear-issues", slug],
    queryFn: () => fetchIssues(slug),
    enabled: !!slug,
  });

  const allIssues: any[] = issuesData ?? [];

  const projects: { id: string; name: string }[] = Array.from(
    new Map(
      allIssues
        .filter((i: any) => i.project?.id && i.project?.name)
        .map((i: any) => [
          i.project.id,
          { id: i.project.id, name: i.project.name },
        ]),
    ).values(),
  );

  const projectFiltered = selectedProject
    ? allIssues.filter((i: any) => i.project?.id === selectedProject)
    : allIssues;

  const availableStatuses = [
    ...new Set(projectFiltered.map((i: any) => i?.state?.name).filter(Boolean)),
  ] as string[];
  const availableLabels = [
    ...new Set(
      projectFiltered.flatMap((i: any) => (i.labels?.nodes ?? []).map((l: any) => l.name)),
    ),
  ] as string[];
  const availablePriorities = [
    ...new Set(projectFiltered.map((i: any) => i.priorityLabel).filter(Boolean)),
  ] as string[];

  const statusFiltered = selectedStatuses.length > 0
    ? projectFiltered.filter((i: any) => selectedStatuses.includes(i?.state?.name))
    : projectFiltered;

  const labelFiltered = selectedLabels.length > 0
    ? statusFiltered.filter((i: any) =>
        (i.labels?.nodes ?? []).some((l: any) => selectedLabels.includes(l.name)),
      )
    : statusFiltered;

  const priorityFiltered = selectedPriorities.length > 0
    ? labelFiltered.filter((i: any) => selectedPriorities.includes(i.priorityLabel))
    : labelFiltered;

  const visibleIssues = [...priorityFiltered].sort((a: any, b: any) => {
    if (sortBy === "estimate") {
      return (b.estimate ?? -1) - (a.estimate ?? -1);
    }
    return new Date(b.updatedAt ?? 0).getTime() - new Date(a.updatedAt ?? 0).getTime();
  });

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
    selectedLabels,
    availableLabels,
    onToggleLabel: (l: string) =>
      setSelectedLabels((prev) =>
        prev.includes(l) ? prev.filter((x) => x !== l) : [...prev, l],
      ),
    selectedPriorities,
    availablePriorities,
    onTogglePriority: (p: string) =>
      setSelectedPriorities((prev) =>
        prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p],
      ),
    onClearFilters: () => {
      setSelectedStatuses([]);
      setSelectedLabels([]);
      setSelectedPriorities([]);
    },
  };

  const selectedProjectName = projects.find((p) => p.id === selectedProject)?.name;

  return (
    <div className="min-h-screen">
      <Header title="Build" subtitle="Guide new features" />

      <div className="p-4 md:p-6 space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
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

          <CreateIssue
            slug={slug}
            profile={profile}
            linearSlug={linearSlug}
            defaultType="feature"
            label="Request Feature"
            compact
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Sort by:</span>
          {(["updated", "estimate"] as const).map((opt) => (
            <button
              key={opt}
              onClick={() => setSortBy(opt)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                sortBy === opt
                  ? "bg-accent text-accent-foreground border-accent/40"
                  : "border-border/40 text-muted-foreground hover:text-foreground hover:border-foreground/30"
              }`}
            >
              {opt === "updated" ? "Last Updated" : "Estimate Value"}
            </button>
          ))}
        </div>

        <div className="w-full max-w-full overflow-hidden">
          {issuesLoading ? (
            <LoadingDataPanel />
          ) : (
            <PriorityTasks
              issuesData={visibleIssues}
              filterState={filterState}
              onOpenChat={() => {}}
              onEditIssue={(issue) => setEditingIssue(issue)}
              title={selectedProjectName ?? "All Tasks"}
            />
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
