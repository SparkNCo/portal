"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from "recharts";
import { TrendingUp } from "lucide-react";
import { useMemo } from "react";
import { PriorityTasksProps } from "./priority-tasks";

/** Status → Color mapping */
const STATUS_COLORS: Record<string, string> = {
  Completed: "hsl(var(--success))",
  Done: "hsl(var(--success))",
  "In Progress": "hsl(var(--warning))",
  "In Review": "hsl(var(--warning))",
  Blocked: "hsl(var(--destructive))",
  "Not Started": "hsl(var(--muted))",
  Todo: "hsl(var(--muted))",
  Canceled: "hsl(var(--muted))",
  QA: "hsl(210, 70%, 35%)",
  Development: "hsl(30, 100%, 35%)",
  UAT: "hsl(180, 60%, 30%)",
  Backlog: "hsl(0, 0%, 30%)",
  Planning: "hsl(50, 90%, 35%)",
};

type TooltipProps = {
  active?: boolean;
  payload?: any[];
};

function CustomTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload || !payload.length) return null;

  const { name, value } = payload[0].payload;

  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="font-medium text-foreground">{name}</p>
      <p className="text-muted-foreground">{value} tasks</p>
    </div>
  );
}

export function ProgressPieChart({ issuesData }: PriorityTasksProps) {
  const chartData = useMemo(() => {
    const counts: Record<string, number> = {};

    for (const issue of issuesData) {
      const stateName = issue?.state?.name;
      if (!stateName) continue;

      counts[stateName] = (counts[stateName] || 0) + 1;
    }

    return Object.entries(counts).map(([name, value]) => ({
      name,
      value,
      color: STATUS_COLORS[name] ?? "hsl(var(--muted))",
    }));
  }, [issuesData]);

  const TOTAL_TASKS = chartData.reduce((sum, item) => sum + item.value, 0);

  const completedTasks =
    (chartData.find((d) => d.name === "Completed")?.value ?? 0) +
    (chartData.find((d) => d.name === "Done")?.value ?? 0);

  const completionPercent =
    TOTAL_TASKS > 0 ? Math.round((completedTasks / TOTAL_TASKS) * 100) : 0;

  return (
    <Card className="bg-background border-border flex flex-col h-fit text-foreground ">
      <CardHeader>
        <CardTitle className="text-body font-semibold flex items-center gap-2 ">
          <TrendingUp className="h-4 w-4 text-chart-1" />
          Project Stats
        </CardTitle>
      </CardHeader>

      <CardContent className="flex flex-col justify-center">
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
              className="flex items-center justify-between text-sm"
            >
              <div className="flex items-center gap-2">
                <div
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-muted-foreground text-xs">
                  {item.name}
                </span>
              </div>
              <span className="font-medium text-background-foreground text-xs">
                {item.value}
              </span>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-3 pt-3 border-t border-border">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Total Tasks</span>
            <span className="text-base font-bold text-background-foreground">
              {TOTAL_TASKS}
            </span>
          </div>
          <div className="flex items-center justify-between mt-0.5">
            <span className="text-xs text-muted-foreground">Completion</span>
            <span className="text-base font-bold text-success">
              {completionPercent}%
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
