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
import { CHART_STATUS_COLORS, STATUS_ORDER } from "@/components/client/issues.types";

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

// Recharts orders a stacked chart's tooltip payload by draw order (last
// area on top first), not by STATUS_ORDER — sort it explicitly so the
// popover always lists statuses in the same fixed order as the chart/legend.
function StatusTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { dataKey?: string; value?: number; color?: string }[];
  label?: string;
}) {
  if (!active || !payload || !payload.length) return null;

  const sorted = [...payload].sort(
    (a, b) => STATUS_ORDER.indexOf(b.dataKey ?? "") - STATUS_ORDER.indexOf(a.dataKey ?? ""),
  );

  return (
    <div
      style={{
        backgroundColor: "oklch(0.13 0 0)",
        border: "1px solid oklch(0.22 0 0)",
        borderRadius: "6px",
        fontSize: "12px",
        padding: "8px 12px",
      }}
    >
      <p style={{ color: "oklch(0.95 0 0)", marginBottom: 4, fontWeight: 500 }}>{label}</p>
      {sorted.map((entry) => (
        <div
          key={entry.dataKey}
          style={{ display: "flex", alignItems: "center", gap: 6, color: "oklch(0.85 0 0)" }}
        >
          <span
            style={{
              display: "inline-block",
              width: 8,
              height: 8,
              borderRadius: 2,
              background: entry.color,
            }}
          />
          <span>
            {entry.dataKey}: {entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export function IssueMetricsView({
  data,
  cycleMetrics = [],
  activeCycleId,
  dateFrom = "",
  dateTo = "",
  spanAllCycles = false,
}: {
  readonly data: IssueMetric[];
  readonly cycleMetrics?: CycleMetric[];
  readonly activeCycleId: string;
  readonly dateFrom?: string;
  readonly dateTo?: string;
  readonly spanAllCycles?: boolean;
}) {
  const cycles = useMemo(
    () => [...cycleMetrics].sort((a, b) => a.number - b.number),
    [cycleMetrics],
  );

  const activeCycle = cycles.find((c) => c.cycle_id === activeCycleId);
  const [legendOpen, setLegendOpen] = useState(false);

  // When the date range (not the cycle picker) is what the user last edited,
  // merge every cycle's daily snapshots that fall in range into one series —
  // same dates across cycles are summed rather than shown as separate points.
  const mergedAcrossCycles = useMemo(() => {
    if (!spanAllCycles) return null;

    const byDate = new Map<string, Record<string, number | string>>();
    for (const cycle of cycles) {
      for (const snapshot of cycle.issues_averages ?? []) {
        const date = String(snapshot.date ?? "");
        if (!date) continue;
        if (dateFrom && date < dateFrom) continue;
        if (dateTo && date > dateTo) continue;

        const entry = byDate.get(date) ?? { date };
        for (const [key, value] of Object.entries(snapshot)) {
          if (key === "date") continue;
          entry[key] = ((entry[key] as number) ?? 0) + ((value as number) ?? 0);
        }
        byDate.set(date, entry);
      }
    }
    return Array.from(byDate.values()).sort((a, b) =>
      String(a.date).localeCompare(String(b.date)),
    );
  }, [spanAllCycles, cycles, dateFrom, dateTo]);

  // Fixed set and order (not derived from whatever happens to be in the
  // current data) so a status is always in the same stacking position and
  // gets the same color across every cycle/date range — matches "Project
  // Stats"' CHART_STATUS_COLORS lookup by name below.
  const uniqueStatuses = STATUS_ORDER;

  const chartData = useMemo(() => {
    if (spanAllCycles) {
      return (mergedAcrossCycles ?? []).map((d) => {
        const point: Record<string, number | string> = { date: d.date ?? "" };
        for (const status of uniqueStatuses) {
          point[status] = (d[status] as number) ?? 0;
        }
        return point;
      });
    }

    const raw = [...(activeCycle?.issues_averages ?? [])].sort((a, b) =>
      String(a.date).localeCompare(String(b.date)),
    );
    return raw
      .filter((d) => {
        const date = String(d.date ?? "");
        if (dateFrom && date < dateFrom) return false;
        if (dateTo && date > dateTo) return false;
        return true;
      })
      .map((d) => {
        const point: Record<string, number | string> = { date: d.date ?? "" };
        for (const status of uniqueStatuses) {
          point[status] = (d[status] as number) ?? 0;
        }
        return point;
      });
  }, [spanAllCycles, mergedAcrossCycles, activeCycle, uniqueStatuses, dateFrom, dateTo]);

  let titleSuffix = "";
  if (spanAllCycles) {
    titleSuffix = " — All cycles in range";
  } else if (activeCycle) {
    titleSuffix = ` — Cycle #${activeCycle.number}`;
  }

  return (
    <Card className="bg-background border-border">
      <CardHeader>
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <BarChart2 className="h-4 w-4 text-accent" />
          Issues by Status
          {titleSuffix}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            No data
          </p>
        ) : (
          <>
            <div className="h-80">
              <ResponsiveContainer width="100%" height={320}>
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
                  <Tooltip content={<StatusTooltip />} />
                  {uniqueStatuses.map((status) => (
                    <Area
                      key={status}
                      type="monotone"
                      dataKey={status}
                      stackId="a"
                      stroke={CHART_STATUS_COLORS[status] ?? "hsl(var(--muted))"}
                      fill={CHART_STATUS_COLORS[status] ?? "hsl(var(--muted))"}
                      fillOpacity={0.4}
                      strokeWidth={2}
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 lg:hidden">
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
                  {uniqueStatuses.map((status) => {
                    const color = CHART_STATUS_COLORS[status] ?? "hsl(var(--muted))";
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
