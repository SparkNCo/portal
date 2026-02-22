"use client";

import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { TimelineHeader, TimelineMonthsHeader } from "./TimelineHeader";
import { ProjectRow } from "./ProjectRow";

export function RoadmapTimeline({ projectMilestones = [] }) {
  const [expandedProjects, setExpandedProjects] = useState<
    Record<string, boolean>
  >({});

  const INITIAL_YEAR = new Date().getFullYear();
  const [year, setYear] = useState(INITIAL_YEAR);

  const groupedMilestones = useMemo(() => {
    return projectMilestones.reduce((acc: Record<string, any[]>, m: any) => {
      const key = m.projectName ?? "Unknown Project";
      acc[key] ??= [];
      acc[key].push(m);
      return acc;
    }, {});
  }, [projectMilestones]);

  return (
    // className="border-4 border-red-500"
    <Card>
      <TimelineHeader
        year={year}
        onPrev={() => setYear((y) => y - 1)}
        onNext={() => setYear((y) => y + 1)}
      />

      <CardContent>
        <TimelineMonthsHeader year={year} /> 
        {Object.entries(groupedMilestones).map(([projectName, milestones]) => (
          <ProjectRow
            key={projectName}
            projectName={projectName}
            milestones={milestones}
            year={year}
            expanded={!!expandedProjects[projectName]}
            onToggle={() =>
              setExpandedProjects((p) => ({
                ...p,
                [projectName]: !p[projectName],
              }))
            }
          />
        ))}
      </CardContent>
    </Card>
  );
}
