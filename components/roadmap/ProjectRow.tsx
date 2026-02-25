import { Box } from "lucide-react";
import { Button } from "@/components/components/ui/button";
import { MilestoneRow, ProjectSummaryBar } from "./ProjectSummaryBar";
import { Milestone } from "./roadmap-timeline";

export interface ProjectRange {
  start: Date;
  end: Date;
}

interface ProjectRowProps {
  projectName: string;
  milestones: Milestone[];
  year: number;
  expanded: boolean;
  onToggle: () => void;
}

interface ProjectHeaderProps {
  projectName: string;
  expanded: boolean;
  onToggle: () => void;
}

export function getProjectRange(milestones: Milestone[]): ProjectRange | null {
  const dates = milestones.flatMap((m) =>
    m.createdAt && m.targetDate
      ? [new Date(m.createdAt), new Date(m.targetDate)]
      : [],
  );

  if (!dates.length) return null;

  return {
    start: new Date(Math.min(...dates.map((d) => d.getTime()))),
    end: new Date(Math.max(...dates.map((d) => d.getTime()))),
  };
}

/* =========================
   Components
========================= */

export function ProjectRow({
  projectName,
  milestones,
  year,
  expanded,
  onToggle,
}: ProjectRowProps) {
  const projectRange = getProjectRange(milestones);

  return (
    <div className="mb-6 space-y-3">
      <ProjectHeader
        projectName={projectName}
        expanded={expanded}
        onToggle={onToggle}
      />

      {!expanded && projectRange && (
        <ProjectSummaryBar
          milestones={milestones}
          range={projectRange}
          year={year}
        />
      )}

      {expanded &&
        milestones.map((m) => (
          <MilestoneRow
            key={m?.projectName + m?.progress}
            data={m}
            year={year}
          />
        ))}
    </div>
  );
}

function ProjectHeader({
  projectName,
  expanded,
  onToggle,
}: ProjectHeaderProps) {
  return (
    <div className="flex justify-between items-center">
      <div className="flex items-center gap-2">
        <Box className="h-4 w-4 text-accent" />
        <h3 className="text-sm font-semibold">{projectName}</h3>
      </div>

      <Button size="sm" variant="ghost" onClick={onToggle}>
        {expanded ? "Collapse" : "Expand"}
      </Button>
    </div>
  );
}
