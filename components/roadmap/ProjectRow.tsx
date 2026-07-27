import { Box, ChevronDown, ChevronRight } from "lucide-react";
import { MilestoneRow, ProjectSummaryBar } from "./ProjectSummaryBar";
import { Milestone } from "./roadmap-timeline";

export interface ProjectRange {
  start: Date;
  end: Date;
}

export interface ChainedMilestone extends Milestone {
  // Previous milestone's targetDate (or the project's start date for the
  // first milestone) — replaces createdAt as the bar's rendered start so
  // milestones sit back-to-back instead of overlapping.
  chainStart: string | null;
}

interface ProjectRowProps {
  projectName: string;
  milestones: Milestone[];
  projectStartDate?: string | null;
  year: number;
  expanded: boolean;
  onToggle: () => void;
  onMilestoneSelect?: (m: Milestone) => void;
  selectedMilestoneId?: string;
}

interface ProjectHeaderProps {
  projectName: string;
  expanded: boolean;
  onToggle: () => void;
}

// Milestones without a targetDate can't be placed on the chain — sort them
// to the end instead of letting an Invalid Date/NaN comparison scramble the
// real, dated milestones around them.
function sortByTargetDate(milestones: Milestone[]): Milestone[] {
  return [...milestones].sort((a, b) => {
    const aTime = a.targetDate ? new Date(a.targetDate).getTime() : Number.POSITIVE_INFINITY;
    const bTime = b.targetDate ? new Date(b.targetDate).getTime() : Number.POSITIVE_INFINITY;
    return aTime - bTime;
  });
}

// A project with zero milestones is treated as having a single, nameless
// one — so it still renders a row/bar instead of an empty state.
function withPlaceholder(
  milestones: Milestone[],
  projectName: string,
  projectStartDate?: string | null,
): Milestone[] {
  if (milestones.length > 0) return milestones;

  return [
    {
      id: `placeholder-${projectName}`,
      createdAt: projectStartDate ?? new Date().toISOString(),
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
      targetDate: projectStartDate ?? new Date().toISOString(),
    },
  ];
}

function chainMilestones(
  milestones: Milestone[],
  projectStartDate?: string | null,
): ChainedMilestone[] {
  const sorted = sortByTargetDate(milestones);
  // A running cursor, not just "the previous entry", so a milestone with no
  // targetDate of its own doesn't wipe out the chain for every milestone
  // after it — it's skipped and the cursor only advances on a real date.
  let cursor = projectStartDate ?? null;
  return sorted.map((m) => {
    if (!m.targetDate) return { ...m, chainStart: null };

    let chainStart = cursor ?? m.createdAt ?? null;
    // A later cursor (e.g. the project's createdAt) landing after this
    // milestone's own targetDate would invert the range — clamp instead of
    // letting the bar disappear.
    if (chainStart && new Date(chainStart).getTime() > new Date(m.targetDate).getTime()) {
      chainStart = m.targetDate;
    }

    cursor = m.targetDate;
    return { ...m, chainStart };
  });
}

export function getProjectRange(chainedMilestones: ChainedMilestone[]): ProjectRange | null {
  const withDates = chainedMilestones.filter((m) => m.chainStart && m.targetDate);
  if (!withDates.length) return null;

  return {
    start: new Date(Math.min(...withDates.map((m) => new Date(m.chainStart!).getTime()))),
    end: new Date(Math.max(...withDates.map((m) => new Date(m.targetDate).getTime()))),
  };
}

/* =========================
   Components
========================= */

export function ProjectRow({
  projectName,
  milestones,
  projectStartDate,
  year,
  expanded,
  onToggle,
  onMilestoneSelect,
  selectedMilestoneId,
}: ProjectRowProps) {
  const chainedMilestones = chainMilestones(
    withPlaceholder(milestones, projectName, projectStartDate),
    projectStartDate,
  );
  const projectRange = getProjectRange(chainedMilestones);

  return (
    <div className="mb-6 space-y-3">
      <ProjectHeader
        projectName={projectName}
        expanded={expanded}
        onToggle={onToggle}
      />

      {!expanded && (
        <button
          type="button"
          onClick={onToggle}
          className="block w-full appearance-none border-0 bg-transparent p-0 text-left"
          aria-label={`Expand ${projectName}`}
        >
          <ProjectSummaryBar
            milestones={chainedMilestones}
            range={projectRange}
            year={year}
          />
        </button>
      )}

      {expanded &&
        chainedMilestones.map((m) => (
          <MilestoneRow
            key={m.projectName + m.name}
            data={m}
            start={m.chainStart}
            end={m.targetDate}
            year={year}
            onSelect={() => onMilestoneSelect?.(m)}
            isSelected={selectedMilestoneId === m.name + m.projectName}
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
