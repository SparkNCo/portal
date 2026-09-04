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
import { useState, useEffect } from "react";
import { fetchIssues, fetchPoliciesStatus } from "../dashboard/page";
import type { Issue } from "@/components/client/issues.types";

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export default function DeveloperDashboard() {
  const { profile } = useUser();
  const queryClient = useQueryClient();
  const { selectedProject: selectedProjectFromSidebar } = useSelectedProject();
  const userId = profile?.id;
  const notionUrl = "https://www.notion.so/YOUR_POLICIES";
  const [showPoliciesModal, setShowPoliciesModal] = useState(false);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [selectedPriorities, setSelectedPriorities] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<"updated" | "priority">("updated");
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

  // Which project to work on is picked from the sidebar dropdown (see
  // components/sidebar.tsx) and lives in SelectedProjectContext, rather than
  // local state, so it's shared with the rest of the /dev/* nav. Falls back
  // to the first assignment so a project is always selected.
  const selectedProject = selectedProjectFromSidebar ?? projects[0]?.clientName ?? null;

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
              My Hours
            </Button>
            <Button size="sm" className="smalltext" onClick={() => setShowLogHours(true)}>
              <Clock className="h-4 w-4" />
              Log Hours
            </Button>
          </>
        }
      />

      <div className="p-4 md:p-6 space-y-6">
        {profile?.developerType !== "internal" && (
          <div className="grid gap-6 md:grid-cols-2">
            <QuickLinks />
            <ToolShortcuts />
          </div>
        )}

        <div className="w-full max-w-full overflow-x-hidden">
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
