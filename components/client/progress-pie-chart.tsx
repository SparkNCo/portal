"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from "recharts";
import { TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";
import { CHART_STATUS_COLORS, STATUS_ORDER, type Issue } from "./issues.types";

// Radix Select reserves value="" for its own placeholder state, so "every
// project" needs a non-empty sentinel.
const ALL_PROJECTS_VALUE = "__all_projects__";

type TooltipProps = {
  active?: boolean;
  payload?: any[];
};

function CustomTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload || !payload.length) return null;

  const { name, value } = payload[0].payload;

  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 smalltext shadow-md">
      <p className="font-medium text-popover-foreground">{name}</p>
      <p className="text-popover-foreground/60">{value} tasks</p>
    </div>
  );
}

export function ProgressPieChart({ issuesData }: { issuesData: Issue[] }) {
  // Self-contained project filter — no cycle/date filter here, just scopes
  // which project's issues feed the chart below.
  const [selectedProject, setSelectedProject] = useState(ALL_PROJECTS_VALUE);

  const projectNames = useMemo(() => {
    const names = new Set<string>();
    for (const issue of issuesData) {
      if (issue.project?.name) names.add(issue.project.name);
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [issuesData]);

  const scopedIssues = useMemo(() => {
    if (selectedProject === ALL_PROJECTS_VALUE) return issuesData;
    return issuesData.filter((issue) => issue.project?.name === selectedProject);
  }, [issuesData, selectedProject]);

  const chartData = useMemo(() => {
    const counts: Record<string, number> = {};

    for (const issue of scopedIssues) {
      const stateName = issue?.state?.name;
      if (!stateName) continue;

      counts[stateName] = (counts[stateName] || 0) + 1;
    }

    return Object.entries(counts)
      .map(([name, value]) => ({
        name,
        value,
        color: CHART_STATUS_COLORS[name] ?? "hsl(var(--muted))",
      }))
      .sort((a, b) => {
        // Reversed from STATUS_ORDER on purpose — Done at the top, Backlog
        // at the bottom (swap ai/bi instead of touching the shared order,
        // which priority-tasks.tsx and issues-metrics.tsx also rely on).
        const ai = STATUS_ORDER.indexOf(a.name);
        const bi = STATUS_ORDER.indexOf(b.name);
        return (bi === -1 ? STATUS_ORDER.length : bi) - (ai === -1 ? STATUS_ORDER.length : ai);
      });
  }, [scopedIssues]);

  const TOTAL_TASKS = chartData.reduce((sum, item) => sum + item.value, 0);

  const completedTasks =
    (chartData.find((d) => d.name === "Completed")?.value ?? 0) +
    (chartData.find((d) => d.name === "Done")?.value ?? 0);

  const completionPercent =
    TOTAL_TASKS > 0 ? Math.round((completedTasks / TOTAL_TASKS) * 100) : 0;

  return (
    <Card className="bg-background border-border flex flex-col text-foreground">
      <CardHeader>
        <CardTitle className="body font-semibold flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Project Stats
          </span>
          {projectNames.length > 1 && (
            <Select value={selectedProject} onValueChange={setSelectedProject}>
              <SelectTrigger className="w-36 h-8 smalltext font-normal">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_PROJECTS_VALUE} className="smalltext focus:text-primary">
                  All Projects
                </SelectItem>
                {projectNames.map((name) => (
                  <SelectItem key={name} value={name} className="smalltext focus:text-primary">
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col justify-center">
        <ResponsiveContainer width="100%" height={160}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={40}
              outerRadius={60}
              paddingAngle={0}
              dataKey="value"
              stroke="none"
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>

            <RechartsTooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>

        {/* Legend */}
        <div className="space-y-1.5 mt-3">
          {chartData.map((item) => (
            <div
              key={item.name}
              className="flex items-center justify-between smalltext"
            >
              <div className="flex items-center gap-2">
                <div
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-muted-foreground smalltext">
                  {item.name}
                </span>
              </div>
              <span className="font-medium text-foreground smalltext">
                {item.value}
              </span>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-3 pt-3 border-t border-border">
          <div className="flex items-center justify-between">
            <span className="smalltext text-muted-foreground">Total Tasks</span>
            <span className="text-base font-bold text-foreground">
              {TOTAL_TASKS}
            </span>
          </div>
          <div className="flex items-center justify-between mt-0.5">
            <span className="smalltext text-muted-foreground">Completion</span>
            <span className="text-base font-bold text-success">
              {completionPercent}%
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
