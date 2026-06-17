"use client";

import { Header } from "@/components/headerDashboard";
import { QuickLinks } from "@/components/developer/quick-links";
import { ToolShortcuts } from "@/components/developer/tool-shortcuts";
import { PriorityTasks } from "@/components/client/priority-tasks";
import { CreateIssue } from "@/components/shared/create-issue";
import { LoadingDataPanel } from "@/components/loader";
import { PolicyApprovalModal } from "@/components/ui/PolicyApprovalModal";
import { useQuery } from "@tanstack/react-query";
import { useUser } from "context/UserContext";
import { useState, useEffect } from "react";
import { fetchIssues, fetchPoliciesStatus } from "../client/page";

export default function DeveloperDashboard() {
  const { profile } = useUser();
  const userId = profile?.id;
  const notionUrl = "https://www.notion.so/YOUR_POLICIES";
  const [showPoliciesModal, setShowPoliciesModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [selectedPriorities, setSelectedPriorities] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<"updated" | "priority">("updated");

  // 🔹 Policies approval query
  const { data: policiesStatus } = useQuery<{ approved: boolean }, Error>({
    queryKey: ["policies-status", userId],
    queryFn: () => fetchPoliciesStatus(userId!),
    enabled: !!userId,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (policiesStatus && !policiesStatus.approved) {
      setShowPoliciesModal(true);
    }
  }, [policiesStatus]);

  const assignments: any[] = Array.isArray(profile?.assignment_id)
    ? (profile.assignment_id as any[])
    : [];

  // Each project: { clientName, linear_slug }
  const projects = assignments
    .filter((a) => a.clientName)
    .map((a) => ({
      clientName: a.clientName as string,
      slug: (a.linear_slug ?? a.clientName) as string,
    }));

  const { data: issuesData, isLoading: issuesLoading } = useQuery({
    queryKey: ["linear-issues-developer", projects.map((p) => p.clientName)],
    queryFn: async () => {
      const results = await Promise.all(
        projects.map(async (p) => {
          const issues = await fetchIssues(p.clientName);
          return issues.map((i: any) => ({ ...i, _project: p.clientName }));
        }),
      );
      return results.flat();
    },
    enabled: projects.length > 0,
  });

  const allIssues: any[] = (issuesData ?? [])
    .filter((i: any) => i?.state?.name !== "Done");

  const availableStatuses = [...new Set(allIssues.map((i: any) => i?.state?.name).filter(Boolean))] as string[];
  const availableLabels = [
    ...new Set(
      allIssues.flatMap((i: any) => (i.labels?.nodes ?? []).map((l: any) => l.name)),
    ),
  ] as string[];
  const availablePriorities = [
    ...new Set(allIssues.map((i: any) => i.priorityLabel).filter(Boolean)),
  ] as string[];

  const projectFiltered = selectedProject
    ? allIssues.filter((i: any) => i._project === selectedProject)
    : allIssues;

  const PRIORITY_ORDER = ["Urgent", "High", "Medium", "Low", "No priority"];

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
    if (sortBy === "priority")
      return PRIORITY_ORDER.indexOf(a.priorityLabel) - PRIORITY_ORDER.indexOf(b.priorityLabel);
    // default: last updated
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

  return (
    <div className="min-h-screen">
      <PolicyApprovalModal
        open={showPoliciesModal}
        userId={userId!}
        notionUrl={notionUrl}
        onApproved={() => setShowPoliciesModal(false)}
      />
      <Header title="Developer Dashboard" subtitle="Good morning, Developer" />

      <div className="p-4 md:p-6 space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
          <QuickLinks />
          <ToolShortcuts />
        </div>

        {projects.length > 1 && (
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
                key={p.clientName}
                onClick={() => setSelectedProject(p.clientName)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                  selectedProject === p.clientName
                    ? "bg-accent text-accent-foreground border-accent/40"
                    : "border-border/40 text-muted-foreground hover:text-foreground hover:border-foreground/30"
                }`}
              >
                {p.clientName}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Sort by:</span>
          {(["updated", "priority"] as const).map((opt) => (
            <button
              key={opt}
              onClick={() => setSortBy(opt)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                sortBy === opt
                  ? "bg-accent text-accent-foreground border-accent/40"
                  : "border-border/40 text-muted-foreground hover:text-foreground hover:border-foreground/30"
              }`}
            >
              {opt === "updated" ? "Last Updated" : "Priority"}
            </button>
          ))}
        </div>
        <div className="w-full max-w-full overflow-hidden ">
          {issuesLoading ? (
            <LoadingDataPanel />
          ) : (
            <PriorityTasks
              issuesData={visibleIssues}
              filterState={filterState}
              onOpenChat={() => {}}
              title={selectedProject ?? "All Tasks"}
            />
          )}
        </div>

        {/* <CreateIssue
          slug={projects[0]?.clientName ?? ""}
          projectId=""
          profile={profile}
        /> */}
      </div>
    </div>
  );
}
