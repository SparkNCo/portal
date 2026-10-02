"use client";

import { Header } from "@/components/headerDashboard";
import { QuickLinks } from "@/components/developer/quick-links";
import { ToolShortcuts } from "@/components/developer/tool-shortcuts";
import { PriorityTasks } from "@/components/client/priority-tasks";
import { CreateIssue } from "@/components/shared/create-issue";
import { LoadingDataPanel } from "@/components/loader";
import { PolicyApprovalModal } from "@/components/ui/PolicyApprovalModal";
import { EditIssueModal } from "@/components/build/edit-issue-modal";
import { LogHoursModal } from "@/components/developer/log-hours-modal";
import { MyHoursModal } from "@/components/developer/my-hours-modal";
import { Button } from "@/components/components/ui/button";
import { Clock, History } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useUser } from "context/UserContext";
import { useSelectedProject } from "@/lib/selected-project-context";
import { pickDeveloperProject } from "@/lib/developer-routes";
import { useParams } from "next/navigation";
import { safeDecodeURIComponent } from "@/lib/utils";
import { useState, useEffect } from "react";
import { fetchIssues, fetchPoliciesStatus } from "../dashboard/page";
import type { Issue, IssueViewMode } from "@/components/client/issues.types";

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

const NO_CYCLE_LABEL = "No cycle";

// A small per-browser preference (falls back to `initial` when storage is
// unavailable or holds something unexpected).
function useStoredChoice<T extends string>(key: string, initial: T, allowed: readonly T[]) {
  const [value, setValue] = useState<T>(initial);
  useEffect(() => {
    try {
      const stored = localStorage.getItem(key) as T | null;
      if (stored && allowed.includes(stored)) setValue(stored);
    } catch {
      // Storage unavailable — keep the default.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const update = (next: T) => {
    setValue(next);
    try {
      localStorage.setItem(key, next);
    } catch {
      // Not remembered, still applied.
    }
  };
  return [value, update] as const;
}

export default function DeveloperDashboard() {
  const { profile } = useUser();
  const queryClient = useQueryClient();
  const { selectedProject: selectedProjectFromSidebar } = useSelectedProject();
  const { slug: rawUrlSlug } = useParams<{ slug?: string }>();
  const urlSlug = rawUrlSlug ? safeDecodeURIComponent(rawUrlSlug) : null;
  const userId = profile?.id;
  const notionUrl = "https://www.notion.so/YOUR_POLICIES";
  const [showPoliciesModal, setShowPoliciesModal] = useState(false);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedCycles, setSelectedCycles] = useState<string[]>([]);
  const [selectedPriorities, setSelectedPriorities] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<"updated" | "priority">("updated");
  // Remembered in this browser; default to the developer's own tickets in a
  // grid.
  const [assigneeScope, setAssigneeScope] = useStoredChoice<"mine" | "all">(
    "developer-tickets-scope",
    "mine",
    ["mine", "all"],
  );
  const [viewMode, setViewMode] = useStoredChoice<IssueViewMode>(
    "developer-tickets-view",
    "grid",
    ["grid", "board", "list"],
  );
  const [editingIssue, setEditingIssue] = useState<Issue | null>(null);
  const [showLogHours, setShowLogHours] = useState(false);
  const [showMyHours, setShowMyHours] = useState(false);

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

  // Each project: { clientName, linear_slug, allocation (weekly hours, for the
  // Log Hours vs. allocation comparison chart) }
  const projects = assignments
    .filter((a) => a.clientName)
    .map((a) => ({
      clientName: a.clientName as string,
      slug: (a.linear_slug ?? a.clientName) as string,
      allocation: (a.allocation ?? null) as number | null,
    }));

  // The initiative in the URL (/{slug}/developer); the sidebar's last pick
  // and then the first assignment only fill in if the URL's slug isn't one
  // of theirs. Issues are still fetched for every assignment (the hours
  // chart compares all of them), then filtered to this one.
  const selectedProject = pickDeveloperProject(profile, urlSlug, selectedProjectFromSidebar);

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
  // "Cycle N" labels of the cycles the listed tickets are in, newest first,
  // plus "No cycle" when some ticket isn't in one.
  const cycleOf = (i: any): string => (i.cycle?.number != null ? `Cycle ${i.cycle.number}` : NO_CYCLE_LABEL);
  const availablePriorities = [
    ...new Set(allIssues.map((i: any) => i.priorityLabel).filter(Boolean)),
  ] as string[];

  const projectIssues = selectedProject
    ? allIssues.filter((i: any) => i._project === selectedProject)
    : allIssues;

  // "My tickets" = assigned to this developer in Linear (matched by email).
  const myEmail = profile?.email?.toLowerCase();
  const isMine = (i: any) => !!myEmail && i.assignee?.email?.toLowerCase() === myEmail;
  const myCount = projectIssues.filter(isMine).length;
  const projectFiltered = assigneeScope === "mine" ? projectIssues.filter(isMine) : projectIssues;

  const PRIORITY_ORDER = ["Urgent", "High", "Medium", "Low", "No priority"];

  const statusFiltered = selectedStatuses.length > 0
    ? projectFiltered.filter((i: any) => selectedStatuses.includes(i?.state?.name))
    : projectFiltered;

  const availableCycles = [...new Set(projectFiltered.map(cycleOf))].sort((a, b) => {
    if (a === NO_CYCLE_LABEL) return 1;
    if (b === NO_CYCLE_LABEL) return -1;
    return Number(b.replace(/\D/g, "")) - Number(a.replace(/\D/g, ""));
  });

  const cycleFiltered = selectedCycles.length > 0
    ? statusFiltered.filter((i: any) => selectedCycles.includes(cycleOf(i)))
    : statusFiltered;

  const priorityFiltered = selectedPriorities.length > 0
    ? cycleFiltered.filter((i: any) => selectedPriorities.includes(i.priorityLabel))
    : cycleFiltered;

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
    selectedCycles,
    availableCycles,
    onToggleCycle: (c: string) =>
      setSelectedCycles((prev) =>
        prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c],
      ),
    selectedPriorities,
    availablePriorities,
    onTogglePriority: (p: string) =>
      setSelectedPriorities((prev) =>
        prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p],
      ),
    onClearFilters: () => {
      setSelectedStatuses([]);
      setSelectedCycles([]);
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
      <Header
        title="Developer Dashboard"
        subtitle={`Welcome back, ${capitalize(profile?.firstName ?? profile?.userName ?? profile?.email ?? "Developer")}`}
        subtitleClassName="smalltext"
        actions={
          <>
            <Button
              size="sm"
              variant="outline"
              className="smalltext"
              onClick={() => setShowMyHours(true)}
            >
              <History className="h-4 w-4" />
              <span className="hidden sm:inline">My Hours</span>
            </Button>
            <Button size="sm" className="smalltext" onClick={() => setShowLogHours(true)}>
              <Clock className="h-4 w-4" />
              <span className="hidden sm:inline">Log Hours</span>
            </Button>
          </>
        }
      />

      <div className="p-4 md:p-6 space-y-6">
        {profile?.developerType !== "internal" && (
          <div className="-mx-4 sm:mx-0 grid gap-6 md:grid-cols-2">
            <QuickLinks />
            <ToolShortcuts />
          </div>
        )}

        <div className="-mx-4 sm:mx-0 overflow-x-hidden">
          {projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border/40 p-10 text-center">
              <p className="smalltext font-medium text-foreground">
                No assigned projects yet
              </p>
              <p className="smalltext text-muted-foreground">
                Once you're assigned to a customer, their issues will show up
                here.
              </p>
            </div>
          ) : issuesLoading ? (
            <LoadingDataPanel />
          ) : (
            <PriorityTasks
              issuesData={visibleIssues}
              filterState={filterState}
              onOpenChat={() => {}}
              onEditIssue={(issue) => setEditingIssue(issue)}
              title={selectedProject ?? "All Tasks"}
              sortBy={sortBy}
              onSortByChange={setSortBy}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              headerAction={
                <div className="flex items-center rounded-md border border-input p-0.5" role="group" aria-label="Whose tickets">
                  {([
                    ["mine", `My tickets (${myCount})`],
                    ["all", `All (${projectIssues.length})`],
                  ] as const).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setAssigneeScope(value)}
                      aria-pressed={assigneeScope === value}
                      className={`h-6 rounded px-2 smalltext font-medium transition-colors ${
                        assigneeScope === value
                          ? "bg-primary/15 text-primary"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              }
              emptyState={
                assigneeScope === "mine" && myCount === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-10 text-center">
                    <p className="smalltext font-medium text-foreground">No open tickets assigned to you</p>
                    <p className="smalltext text-muted-foreground">
                      Tickets assigned to {profile?.email} in Linear show up here.
                    </p>
                    <Button size="sm" variant="outline" className="smalltext" onClick={() => setAssigneeScope("all")}>
                      Show all tickets
                    </Button>
                  </div>
                ) : undefined
              }
            />
          )}
        </div>

        {/* <CreateIssue
          slug={projects[0]?.clientName ?? ""}
          projectId=""
          profile={profile}
        /> */}
      </div>

      {editingIssue && (
        <EditIssueModal
          issue={editingIssue}
          slug={(editingIssue as any)._project ?? projects[0]?.clientName ?? ""}
          onClose={() => setEditingIssue(null)}
          onSaved={() =>
            queryClient.invalidateQueries({
              queryKey: ["linear-issues-developer", projects.map((p) => p.clientName)],
            })
          }
        />
      )}

      {showLogHours && profile?.id && profile?.email && (
        <LogHoursModal
          projects={projects}
          issues={allIssues}
          developerId={profile.id}
          developerEmail={profile.email}
          onClose={() => setShowLogHours(false)}
          onChanged={() =>
            queryClient.invalidateQueries({ queryKey: ["hours-logged", profile.id] })
          }
        />
      )}

      {showMyHours && profile?.id && profile?.email && (
        <MyHoursModal
          projects={projects}
          issues={allIssues}
          developerId={profile.id}
          developerEmail={profile.email}
          onClose={() => setShowMyHours(false)}
        />
      )}
    </div>
  );
}
