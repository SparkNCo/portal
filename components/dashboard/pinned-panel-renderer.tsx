"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ProgressPieChart } from "@/components/client/progress-pie-chart";
import { SoftwareKPIs } from "@/components/roadmap/software-kpis";
import { RoadmapTimeline } from "@/components/roadmap/roadmap-timeline";
import { MetricsPanel } from "@/components/metrics/metrics-panel";
import { PriorityTasks } from "@/components/client/priority-tasks";
import { PinButton } from "@/components/dashboard/pin-button";
import type { PinnablePanelId } from "@/lib/pinnable-panels";

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

function useRoadmapMilestones(slug: string) {
  const { data: roadmap } = useQuery({
    queryKey: ["roadmap", slug],
    queryFn: async () => {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/roadmap/?slug=${encodeURIComponent(slug)}`,
        {
          headers: {
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_KEY}`,
            apikey: process.env.NEXT_PUBLIC_SUPABASE_KEY!,
            "Content-Type": "application/json",
          },
        },
      );
      if (!res.ok) throw new Error("Failed to fetch roadmap");
      return res.json();
    },
    enabled: Boolean(slug),
  });

  const derived = useMemo(() => {
    const projects = roadmap?.initiative?.projects?.nodes ?? [];
    const milestones = projects.flatMap((project: any) =>
      (project.projectMilestones?.nodes ?? []).map((milestone: any) => ({
        ...milestone,
        projectName: project.name,
      })),
    );
    const projectNames = projects.map((project: any) => project.name);
    const cycles = roadmap?.cycles?.nodes ?? [];
    return { milestones, projectNames, cycles };
  }, [roadmap]);

  return derived;
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
    return (
      <div className="relative">
        {!hidePinButton && <PinButton panelId={panelId} />}
        <ProgressPieChart issuesData={allIssues} />
      </div>
    );
  }

  if (panelId === "software_kpis") {
    return (
      <div className="relative">
        {!hidePinButton && <PinButton panelId={panelId} />}
        <SoftwareKPIs linearName={slug} />
      </div>
    );
  }

  if (panelId === "metrics_panel") {
    return (
      <div className="relative">
        {!hidePinButton && <PinButton panelId={panelId} />}
        <MetricsPanel slug={slug} />
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
        <PriorityTasks
          issuesData={issues}
          filterState={noopFilterState}
          onOpenChat={onOpenChat ?? (() => {})}
          onEditIssue={onEditIssue}
          title="Business Review"
          compact
        />
      </div>
    );
  }

  if (panelId === "build_acceptance_testing") {
    const issues = allIssues.filter(
      (i) => i.state?.name === "UAT" && matchesSelectedProject(i),
    );
    return (
      <div className="relative">
        {!hidePinButton && <PinButton panelId={panelId} />}
        <PriorityTasks
          issuesData={issues}
          filterState={noopFilterState}
          onOpenChat={onOpenChat ?? (() => {})}
          onEditIssue={onEditIssue}
          title="Acceptance Testing"
          compact
        />
      </div>
    );
  }

  if (panelId === "bugs_list") {
    const bugs = allIssues
      .filter((i) =>
        (i.labels?.nodes ?? []).some((l: any) => l.name?.toLowerCase() === "bug"),
      )
      .sort((a, b) => {
        const rankA = PRIORITY_RANK[a.priorityLabel] ?? 0;
        const rankB = PRIORITY_RANK[b.priorityLabel] ?? 0;
        if (rankA !== rankB) return rankB - rankA;
        return (
          new Date(a.createdAt ?? 0).getTime() -
          new Date(b.createdAt ?? 0).getTime()
        );
      });

    return (
      <div className="relative w-full max-w-full overflow-hidden">
        {!hidePinButton && <PinButton panelId={panelId} />}
        <PriorityTasks
          issuesData={bugs}
          filterState={noopFilterState}
          onOpenChat={() => {}}
          onEditIssue={onEditIssue}
          title="Bugs"
          compact
        />
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
  const { milestones, projectNames, cycles } = useRoadmapMilestones(slug);
  return (
    <div className="relative">
      {!hidePinButton && <PinButton panelId={panelId} />}
      <RoadmapTimeline
        projectMilestones={milestones}
        allProjectNames={projectNames}
        cycles={cycles}
        slug={slug}
      />
    </div>
  );
}
