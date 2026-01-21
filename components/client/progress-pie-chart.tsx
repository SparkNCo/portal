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

const data = [
  { name: "Completed", value: 24, color: "hsl(var(--success))" },
  { name: "In Progress", value: 8, color: "hsl(var(--warning))" },
  { name: "Blocked", value: 2, color: "hsl(var(--destructive))" },
  { name: "Not Started", value: 12, color: "hsl(var(--muted))" },
];

const TOTAL_TASKS = data.reduce((sum, item) => sum + item.value, 0);

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

export function ProgressPieChart() {
  return (
    <Card className="bg-card border-border h-full flex flex-col">
      <CardHeader>
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-chart-1" />
          Project Stats
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col justify-center">
        <ResponsiveContainer width="100%" height={160}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={40}
              outerRadius={60}
              paddingAngle={2}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>

            <RechartsTooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>

        <div className="space-y-1.5 mt-3">
          {data.map((item) => (
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
              <span className="font-medium text-card-foreground text-xs">
                {item.value}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-3 pt-3 border-t border-border">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Total Tasks</span>
            <span className="text-base font-bold text-card-foreground">
              {TOTAL_TASKS}
            </span>
          </div>
          <div className="flex items-center justify-between mt-0.5">
            <span className="text-xs text-muted-foreground">Completion</span>
            <span className="text-base font-bold text-success">
              {Math.round((24 / TOTAL_TASKS) * 100)}%
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
