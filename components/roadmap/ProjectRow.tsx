import { Box } from "lucide-react";
import { Button } from "../ui/button";
import { MilestoneRow, ProjectSummaryBar } from "./ProjectSummaryBar";

export function getProjectRange(milestones: any[]) {
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

export function ProjectRow({
  projectName,
  milestones,
  year,
  expanded,
  onToggle,
}) {
  const projectRange = getProjectRange(milestones);

  return (
    //className="border-4 border-red-500"
    <div className="mb-6 space-y-3 ">
      <ProjectHeader
        projectName={projectName}
        expanded={expanded}
        onToggle={onToggle}
      />
      <div
        onClick={() =>
          console.log({
            milestones,
            start: projectRange?.start.getMonth(),
            end: projectRange?.end.getMonth(),
          })
        }
      >
        VER CONVER
      </div>

      {!expanded && projectRange && (
        <ProjectSummaryBar
          milestones={milestones}
          range={projectRange}
          year={year}
        />
      )}

      {expanded &&
        milestones.map((m) => (
          <MilestoneRow key={m.id + m.createdAt} data={m} year={year} />
        ))}
    </div>
  );
}

function ProjectHeader({ projectName, expanded, onToggle }) {
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
