"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ProgressPieChart } from "@/components/client/progress-pie-chart";
import { SoftwareKPIs } from "@/components/roadmap/software-kpis";
import { RoadmapTimeline } from "@/components/roadmap/roadmap-timeline";
import { MetricsPanel } from "@/components/metrics/metrics-panel";
import { PriorityTasks } from "@/components/client/priority-tasks";
import { PinButton } from "@/components/dashboard/pin-button";
import type { PinnablePanelId } from "@/lib/pinnable-panels";
import { API_HEADERS } from "@/lib/api-headers";

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

function useRoadmapMilestones(slug: string) {
  const { data: roadmap } = useQuery({
    queryKey: ["roadmap", slug],
    queryFn: async () => {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/roadmap/?slug=${encodeURIComponent(slug)}`,
        { headers: API_HEADERS },
      );
      if (!res.ok) throw new Error("Failed to fetch roadmap");
      return res.json();
    },
    enabled: Boolean(slug),
  });

  const [projectNodes, setProjectNodes] = useState<any[]>([]);
  const [projectsCursor, setProjectsCursor] = useState<string | null>(null);
  const [hasMoreProjects, setHasMoreProjects] = useState(false);
  const [loadingMoreProjects, setLoadingMoreProjects] = useState(false);

  useEffect(() => {
    if (!roadmap?.initiative?.projects) return;

    setProjectNodes(roadmap.initiative.projects.nodes ?? []);
    setProjectsCursor(roadmap.initiative.projects.pageInfo?.endCursor ?? null);
    setHasMoreProjects(roadmap.initiative.projects.pageInfo?.hasNextPage ?? false);
  }, [roadmap]);

  async function handleLoadMoreProjects() {
    if (!slug || !projectsCursor || loadingMoreProjects) return;
    setLoadingMoreProjects(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/roadmap/?slug=${encodeURIComponent(slug)}&projectsAfter=${encodeURIComponent(projectsCursor)}`,
        { headers: API_HEADERS },
      );
      if (!res.ok) throw new Error("Failed to load more projects");
      const data = await res.json();
      const nextProjects = data?.initiative?.projects;
      setProjectNodes((prev) => [...prev, ...(nextProjects?.nodes ?? [])]);
      setProjectsCursor(nextProjects?.pageInfo?.endCursor ?? null);
      setHasMoreProjects(nextProjects?.pageInfo?.hasNextPage ?? false);
    } catch (err) {
      console.error("Failed to load more projects:", err);
    } finally {
      setLoadingMoreProjects(false);
    }
  }

  const derived = useMemo(() => {
    const milestones = projectNodes.flatMap((project: any) =>
      (project.projectMilestones?.nodes ?? []).map((milestone: any) => ({
        ...milestone,
        projectName: project.name,
      })),
    );
    const projectNames = projectNodes.map((project: any) => project.name);
    const projectIdsByName: Record<string, string> = Object.fromEntries(
      projectNodes.map((project: any) => [project.name, project.id]),
    );
    const cycles = roadmap?.cycles?.nodes ?? [];
    return { milestones, projectNames, projectIdsByName, cycles };
  }, [projectNodes, roadmap]);

  return { ...derived, hasMoreProjects, loadingMoreProjects, onLoadMoreProjects: handleLoadMoreProjects };
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

  // The pin button is absolutely positioned, so it doesn't reserve any
  // space on its own — panels rendered with their own PinButton (i.e. not
  // already wrapped by SortablePinnedPanel, which reserves this space
  // itself) need their content pushed down so the button doesn't sit on top
  // of the panel's own title.
  const contentPadding = hidePinButton ? "" : "pt-12";

  if (panelId === "progress_pie_chart") {
    const issues = allIssues.filter(matchesSelectedProject);
    return (
      <div className="relative">
        {!hidePinButton && <PinButton panelId={panelId} />}
        <div className={contentPadding}>
          <ProgressPieChart issuesData={issues} />
        </div>
      </div>
    );
  }

  if (panelId === "software_kpis") {
    return (
      <div className="relative">
        {!hidePinButton && <PinButton panelId={panelId} />}
        <div className={contentPadding}>
          <SoftwareKPIs linearName={slug} />
        </div>
      </div>
    );
  }

  if (panelId === "metrics_panel") {
    return (
      <div className="relative">
        {!hidePinButton && <PinButton panelId={panelId} />}
        <div className={contentPadding}>
          <MetricsPanel slug={slug} />
        </div>
      </div>
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
      <div className="relative">
        {!hidePinButton && <PinButton panelId={panelId} />}
        <div className={contentPadding}>
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
        </div>
      </div>
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
      <div className="relative">
        {!hidePinButton && <PinButton panelId={panelId} />}
        <div className={contentPadding}>
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
        </div>
      </div>
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
      <div className="relative w-full max-w-full overflow-hidden">
        {!hidePinButton && <PinButton panelId={panelId} />}
        <div className={contentPadding}>
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
        </div>
      </div>
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
    cycles,
    hasMoreProjects,
    loadingMoreProjects,
    onLoadMoreProjects,
  } = useRoadmapMilestones(slug);
  return (
    <div className="relative">
      {!hidePinButton && <PinButton panelId={panelId} />}
      <div className={hidePinButton ? "" : "pt-12"}>
        <RoadmapTimeline
          projectMilestones={milestones}
          allProjectNames={projectNames}
          projectIdsByName={projectIdsByName}
          cycles={cycles}
          slug={slug}
          hasMoreProjects={hasMoreProjects}
          loadingMoreProjects={loadingMoreProjects}
          onLoadMoreProjects={onLoadMoreProjects}
        />
      </div>
    </div>
  );
}
