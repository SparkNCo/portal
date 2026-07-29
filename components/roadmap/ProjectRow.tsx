import { Box, ChevronDown, ChevronRight } from "lucide-react";
import { MilestoneRow, ProjectSummaryBar } from "./ProjectSummaryBar";
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
  // null means "the whole project" (collapsed summary row); a milestone
  // name scopes the selection to just that milestone's issues instead.
  milestoneName: string | null;
  cycleKey: string;
};

interface ProjectRowProps {
  projectName: string;
  milestones: Milestone[];
  buckets: TimeBucket[];
  expanded: boolean;
  onToggle: () => void;
  selection: CycleSelection | null;
  onCycleSelect: (selection: CycleSelection) => void;
}

interface ProjectHeaderProps {
  projectName: string;
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
function withPlaceholder(milestones: Milestone[], projectName: string): Milestone[] {
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
  milestones,
  buckets,
  expanded,
  onToggle,
  selection,
  onCycleSelect,
}: ProjectRowProps) {
  const chainedMilestones = withCycleIds(withPlaceholder(milestones, projectName));

  const isThisProjectSelected = selection?.projectName === projectName;

  return (
    <div className="mb-6 space-y-3">
      <ProjectHeader
        projectName={projectName}
        expanded={expanded}
        onToggle={onToggle}
      />

      {!expanded && (
        <ProjectSummaryBar
          projectName={projectName}
          milestones={chainedMilestones}
          buckets={buckets}
          selectedCycleKey={
            isThisProjectSelected && selection?.milestoneName === null
              ? selection.cycleKey
              : null
          }
          onCycleClick={(cycleKey) =>
            onCycleSelect({ projectName, milestoneName: null, cycleKey })
          }
        />
      )}

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
              onCycleSelect({ projectName, milestoneName: m.name, cycleKey })
            }
          />
        ))}
    </div>
  );
}

function ProjectHeader({ projectName, expanded, onToggle }: ProjectHeaderProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center justify-between gap-2 appearance-none border-0 bg-transparent p-0 text-left"
      aria-expanded={expanded}
      aria-label={expanded ? `Collapse ${projectName}` : `Expand ${projectName}`}
    >
      <div className="flex items-center gap-2">
        <Box className="h-4 w-4 text-accent" />
        <h3 className="text-sm font-semibold">{projectName}</h3>
      </div>
      {expanded ? (
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      ) : (
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      )}
    </button>
  );
}
