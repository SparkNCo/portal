"use client";

import type { ReactNode } from "react";
import { ProgressPieChart } from "@/components/client/progress-pie-chart";
import { SoftwareKPIs } from "@/components/roadmap/software-kpis";
import { RoadmapTimeline } from "@/components/roadmap/roadmap-timeline";
import { MetricsPanel } from "@/components/metrics/metrics-panel";
import { PriorityTasks } from "@/components/client/priority-tasks";
import { PinButton } from "@/components/dashboard/pin-button";
import type { PinnablePanelId } from "@/lib/pinnable-panels";
import { useRoadmapData } from "@/hooks/use-roadmap-data";
import { cn } from "@/lib/utils";

const noopFilterState = {
  selectedStatuses: [],
  onlyActive: false,
  availableStatuses: [],
  hasCycles: false,
  onToggleStatus: () => {},
  onToggleActive: () => {},
  onClearFilters: () => {},
};

const PRIORITY_RANK: Record<string, number> = {
  Urgent: 4,
  High: 3,
  Medium: 2,
  Low: 1,
};

// Closest-to-done first (Done itself is excluded — handled separately so it
// always sinks to the very bottom regardless of priority). Reverse of the
// forward workflow order in STATUS_ORDER (issues.types.ts): Backlog →
// Planning → Business Review → Development → QA → UAT → Done.
const STATUS_RANK: Record<string, number> = {
  UAT: 5,
  QA: 4,
  Development: 3,
  "Business Review": 2,
  Planning: 1,
  Backlog: 0,
};

// The wrapper every panel branch below repeats identically: a relatively
// positioned container with the PinButton floated in its corner (skipped
// when the caller already reserves that space itself — see hidePinButton's
// docs on PinnedPanelRenderer), and content pushed down to clear it.
function PinnedPanelShell({
  panelId,
  hidePinButton,
  className,
  children,
}: Readonly<{
  panelId: PinnablePanelId;
  hidePinButton?: boolean;
  className?: string;
  children: ReactNode;
}>) {
  return (
    <div className={cn("relative", className)}>
      {!hidePinButton && <PinButton panelId={panelId} />}
      <div className={hidePinButton ? "" : "pt-12"}>{children}</div>
    </div>
  );
}

export function PinnedPanelRenderer({
  panelId,
  slug,
  allIssues,
  selectedProjectIds,
  onOpenChat,
  onEditIssue,
  hidePinButton,
}: Readonly<{
  panelId: PinnablePanelId;
  slug: string;
  allIssues: any[];
  selectedProjectIds?: Set<string>;
  onOpenChat?: (title: string) => void;
  onEditIssue?: (issue: any) => void;
  hidePinButton?: boolean;
}>) {
  const matchesSelectedProject = (i: any) =>
    !selectedProjectIds ||
    selectedProjectIds.size === 0 ||
    selectedProjectIds.has(i.project?.id);

  if (panelId === "progress_pie_chart") {
    const issues = allIssues.filter(matchesSelectedProject);
    return (
      <PinnedPanelShell panelId={panelId} hidePinButton={hidePinButton}>
        <ProgressPieChart issuesData={issues} />
      </PinnedPanelShell>
    );
  }

  if (panelId === "software_kpis") {
    return (
      <PinnedPanelShell panelId={panelId} hidePinButton={hidePinButton}>
        <SoftwareKPIs linearName={slug} />
      </PinnedPanelShell>
    );
  }

  if (panelId === "metrics_panel") {
    return (
      <PinnedPanelShell panelId={panelId} hidePinButton={hidePinButton}>
        <MetricsPanel slug={slug} />
      </PinnedPanelShell>
    );
  }

  if (panelId === "roadmap_timeline") {
    return (
      <RoadmapTimelinePinned
        panelId={panelId}
        slug={slug}
        hidePinButton={hidePinButton}
      />
    );
  }

  if (panelId === "build_product_decisions") {
    const issues = allIssues.filter(
      (i) => i.state?.name === "Business Review" && matchesSelectedProject(i),
    );
    return (
      <PinnedPanelShell panelId={panelId} hidePinButton={hidePinButton}>
        <PriorityTasks
          issuesData={issues}
          filterState={noopFilterState}
          onOpenChat={onOpenChat ?? (() => {})}
          onEditIssue={onEditIssue}
          title="Business Review"
          slug={slug}
          compact
          lightCard
        />
      </PinnedPanelShell>
    );
  }

  if (panelId === "build_acceptance_testing") {
    const issues = allIssues
      .filter((i) => i.state?.name === "UAT" && matchesSelectedProject(i))
      .sort(
        (a, b) =>
          new Date(b.updatedAt ?? 0).getTime() - new Date(a.updatedAt ?? 0).getTime(),
      );
    return (
      <PinnedPanelShell panelId={panelId} hidePinButton={hidePinButton}>
        <PriorityTasks
          issuesData={issues}
          filterState={noopFilterState}
          onOpenChat={onOpenChat ?? (() => {})}
          onEditIssue={onEditIssue}
          title="Acceptance Testing"
          slug={slug}
          compact
          lightCard
        />
      </PinnedPanelShell>
    );
  }

  if (panelId === "bugs_list") {
    const bugs = allIssues
      .filter((i) =>
        (i.labels?.nodes ?? []).some((l: any) => l.name?.toLowerCase() === "bug"),
      )
      .sort((a, b) => {
        // Done bugs sink to the bottom regardless of priority — they can't be
        // edited from here anymore, so they'd otherwise clutter the top of a
        // list meant to surface what still needs attention.
        const doneA = a.state?.name === "Done" ? 1 : 0;
        const doneB = b.state?.name === "Done" ? 1 : 0;
        if (doneA !== doneB) return doneA - doneB;

        const rankA = PRIORITY_RANK[a.priorityLabel] ?? 0;
        const rankB = PRIORITY_RANK[b.priorityLabel] ?? 0;
        if (rankA !== rankB) return rankB - rankA;

        const statusRankA = STATUS_RANK[a.state?.name ?? ""] ?? -1;
        const statusRankB = STATUS_RANK[b.state?.name ?? ""] ?? -1;
        if (statusRankA !== statusRankB) return statusRankB - statusRankA;

        return (
          new Date(a.createdAt ?? 0).getTime() -
          new Date(b.createdAt ?? 0).getTime()
        );
      });

    return (
      <PinnedPanelShell
        panelId={panelId}
        hidePinButton={hidePinButton}
        className="w-full max-w-full overflow-hidden"
      >
        <PriorityTasks
          issuesData={bugs}
          filterState={noopFilterState}
          onOpenChat={() => {}}
          onEditIssue={onEditIssue}
          title="Bugs"
          slug={slug}
          compact
          lightCard
        />
      </PinnedPanelShell>
    );
  }

  return null;
}

function RoadmapTimelinePinned({
  panelId,
  slug,
  hidePinButton,
}: Readonly<{
  panelId: PinnablePanelId;
  slug: string;
  hidePinButton?: boolean;
}>) {
  const {
    milestones,
    projectNames,
    projectIdsByName,
    projectColorByName,
    cycles,
    hasMoreProjects,
    loadingMoreProjects,
    onLoadMoreProjects,
  } = useRoadmapData(slug);
  return (
    <PinnedPanelShell panelId={panelId} hidePinButton={hidePinButton}>
      <RoadmapTimeline
        projectMilestones={milestones}
        allProjectNames={projectNames}
        projectIdsByName={projectIdsByName}
        projectColorByName={projectColorByName}
        cycles={cycles}
        slug={slug}
        hasMoreProjects={hasMoreProjects}
        loadingMoreProjects={loadingMoreProjects}
        onLoadMoreProjects={onLoadMoreProjects}
      />
    </PinnedPanelShell>
  );
}
