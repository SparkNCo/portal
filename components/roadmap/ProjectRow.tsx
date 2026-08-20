import { Box, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { MilestoneRow } from "./ProjectSummaryBar";
import { Milestone } from "./roadmap-timeline";
import type { TimeBucket } from "./TimelineHeader";

export interface ChainedMilestone extends Milestone {
  // Which cycles this milestone actually has issues in — used to highlight
  // cycle columns directly by membership. Milestones frequently have no
  // targetDate at all, so date-range logic can't be relied on; cycle
  // membership comes straight from each issue's own `cycle` field instead.
  cycleIds: Set<string>;
}

export type CycleSelection = {
  projectName: string;
  projectId: string | null;
  // null means "the whole project" (collapsed summary row); a milestone
  // name/id scopes the selection to just that milestone's issues instead.
  milestoneName: string | null;
  milestoneId: string | null;
  cycleKey: string;
};

interface ProjectRowProps {
  projectName: string;
  projectId: string | null;
  milestones: Milestone[];
  buckets: TimeBucket[];
  expanded: boolean;
  onToggle: () => void;
  selection: CycleSelection | null;
  onCycleSelect: (selection: CycleSelection) => void;
}

interface ProjectHeaderProps {
  projectName: string;
  milestoneCount: number;
  expanded: boolean;
  onToggle: () => void;
}

function getCycleIds(milestone: Milestone): Set<string> {
  const ids = new Set<string>();
  for (const issue of milestone.issues?.nodes ?? []) {
    const cycleId = issue?.cycle?.id;
    if (cycleId) ids.add(cycleId);
  }
  return ids;
}

// A project with zero milestones is treated as having a single, nameless
// one — so it still renders a row instead of an empty state.
function withPlaceholder(
  milestones: Milestone[],
  projectName: string,
): Milestone[] {
  if (milestones.length > 0) return milestones;

  return [
    {
      id: `placeholder-${projectName}`,
      createdAt: new Date().toISOString(),
      currentProgress: {
        scopeCount: 0,
        scopeEstimate: 0,
        unstartedEstimate: 0,
        unstartedIssueCount: 0,
      },
      description: null,
      issues: { nodes: [] },
      name: "",
      progress: 0,
      progressHistory: [],
      projectName,
      status: "unstarted",
      targetDate: "",
    },
  ];
}

function withCycleIds(milestones: Milestone[]): ChainedMilestone[] {
  return milestones.map((m) => ({ ...m, cycleIds: getCycleIds(m) }));
}

/* =========================
   Components
========================= */

export function ProjectRow({
  projectName,
  projectId,
  milestones,
  buckets,
  expanded,
  onToggle,
  selection,
  onCycleSelect,
}: ProjectRowProps) {
  const chainedMilestones = withCycleIds(
    withPlaceholder(milestones, projectName),
  );

  const isThisProjectSelected = selection?.projectName === projectName;

  return (
    <div className={cn(expanded ? "space-y-3 mb-6" : "mb-1")}>
      <ProjectHeader
        projectName={projectName}
        milestoneCount={milestones.length}
        expanded={expanded}
        onToggle={onToggle}
      />

      {expanded &&
        chainedMilestones.map((m) => (
          <MilestoneRow
            key={m.projectName + m.name}
            data={m}
            cycleIds={m.cycleIds}
            buckets={buckets}
            selectedCycleKey={
              isThisProjectSelected && selection?.milestoneName === m.name
                ? selection.cycleKey
                : null
            }
            onCycleClick={(cycleKey) =>
              onCycleSelect({
                projectName,
                projectId,
                // The placeholder milestone used for projects with none yet
                // has an empty name and no real Linear id — treat it as "no
                // milestone" so it only filters by project.
                milestoneName: m.name || null,
                milestoneId: m.name ? m.id : null,
                cycleKey,
              })
            }
          />
        ))}
    </div>
  );
}

function ProjectHeader({
  projectName,
  milestoneCount,
  expanded,
  onToggle,
}: ProjectHeaderProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center justify-between gap-2 rounded-lg border border-border 
      bg-card/90 px-3 py-2.5 text-left transition-colors hover:bg-card/75"
      aria-expanded={expanded}
      aria-label={
        expanded ? `Collapse ${projectName}` : `Expand ${projectName}`
      }
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
          <Box className="h-4 w-4 text-primary" />
        </div>
        <h3 className="truncate smalltext  text-card-foreground font-semibold">
          {projectName}
        </h3>
        <span className="shrink-0 rounded-md bg-muted/90 px-2 py-0.5 smalltext text-primary">
          {milestoneCount} milestone{milestoneCount === 1 ? "" : "s"}
        </span>
      </div>
      {expanded ? (
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
      ) : (
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      )}
    </button>
  );
}
