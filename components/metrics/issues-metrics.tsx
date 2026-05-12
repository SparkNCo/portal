"use client";

import { useMemo, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart2, ChevronDown } from "lucide-react";

interface IssueMetric {
  id: string;
  cycle_issue_id: string;
  project_id: string;
  customer_id: string;
  status: string;
  label: string;
  created_at: string;
  count: number;
  points: number;
  cycle: string;
  title: string | null;
}

interface CycleMetric {
  cycle_id: string;
  number: number;
  name: string;
  issues_averages: Record<string, number | string>[];
}

const STATUS_ORDER = [
  "Planning",
  "Business Review",
  "Development",
  "QA",
  "UAT",
  "Done",
];

const LINE_COLORS = [
  "oklch(0.65 0.2 250)",
  "oklch(0.7 0.18 140)",
  "oklch(0.7 0.2 30)",
  "oklch(0.65 0.2 0)",
  "oklch(0.65 0.15 300)",
  "oklch(0.7 0.15 200)",
];

export function IssueMetricsView({
  data,
  cycleMetrics = [],
  activeCycleId,
}: {
  readonly data: IssueMetric[];
  readonly cycleMetrics?: CycleMetric[];
  readonly activeCycleId: string;
}) {
  const cycles = useMemo(
    () => [...cycleMetrics].sort((a, b) => a.number - b.number),
    [cycleMetrics],
  );

  const activeCycle = cycles.find((c) => c.cycle_id === activeCycleId);
  const [legendOpen, setLegendOpen] = useState(false);

  const uniqueStatuses = useMemo(() => {
    const raw = activeCycle?.issues_averages ?? [];
    const statuses = Array.from(
      new Set(raw.flatMap((d) => Object.keys(d).filter((k) => k !== "date"))),
    );
    return statuses.sort(
      (a, b) =>
        (STATUS_ORDER.indexOf(a) ?? 99) - (STATUS_ORDER.indexOf(b) ?? 99),
    );
  }, [activeCycle]);

  const chartData = useMemo(() => {
    const raw = [...(activeCycle?.issues_averages ?? [])].sort((a, b) =>
      String(a.date).localeCompare(String(b.date)),
    );
    return raw.map((d) => {
      const point: Record<string, number | string> = { date: d.date ?? "" };
      for (const status of uniqueStatuses) {
        point[status] = (d[status] as number) ?? 0;
      }
      return point;
    });
  }, [activeCycle, uniqueStatuses]);

  return (
    <Card className="bg-background border-border">
      <CardHeader>
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <BarChart2 className="h-4 w-4 text-accent" />
          Issues by Status
          {activeCycle ? ` — Cycle #${activeCycle.number}` : ""}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            No data
          </p>
        ) : (
          <>
            <div className="h-72 sm:h-56">
              <ResponsiveContainer width="100%" height={288}>
                <AreaChart data={chartData}>
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: "oklch(0.6 0 0)" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "oklch(0.6 0 0)" }}
                    axisLine={false}
                    tickLine={false}
                    width={30}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "oklch(0.13 0 0)",
                      border: "1px solid oklch(0.22 0 0)",
                      borderRadius: "6px",
                      fontSize: "12px",
                    }}
                    labelStyle={{ color: "oklch(0.95 0 0)" }}
                  />
                  {uniqueStatuses.map((status, i) => (
                    <Area
                      key={status}
                      type="monotone"
                      dataKey={status}
                      stackId="a"
                      stroke={LINE_COLORS[i % LINE_COLORS.length]}
                      fill={LINE_COLORS[i % LINE_COLORS.length]}
                      fillOpacity={0.4}
                      strokeWidth={2}
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3">
              <button
                onClick={() => setLegendOpen((o) => !o)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronDown
                  className={`h-3 w-3 transition-transform duration-200 ${legendOpen ? "rotate-180" : ""}`}
                />
                Legend
              </button>
              {legendOpen && (
                <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5">
                  {uniqueStatuses.map((status, i) => {
                    const color = LINE_COLORS[i % LINE_COLORS.length];
                    return (
                      <div key={status} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span style={{ display: "inline-block", width: 12, height: 12, borderRadius: 2, background: color, opacity: 0.8 }} />
                        {status}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
