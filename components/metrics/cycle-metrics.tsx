"use client";

import { useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AlertCircle, ChevronDown, RefreshCw } from "lucide-react";

interface CycleMetric {
  id: string;
  cycle_id: string;
  name: string | null;
  number: number;
  description: string | null;
  completed_at: string | null;
  starts_at: string | null;
  ends_at: string | null;
  scope_history: number[];
  completed_scope_history: number[];
  uncompleted_issues_upon_close: any[];
  cycle_issue_ids: string[];
  created_at: string;
}

interface UncompletedIssue {
  id: string;
  number: number;
  title: string;
  priority: number;
  dueDate: string | null;
  addedToCycleAt: string;
}

const CYCLE_COLORS = [
  "oklch(0.65 0.2 250)",
  "oklch(0.7 0.18 140)",
  "oklch(0.7 0.2 30)",
  "oklch(0.65 0.2 320)",
  "oklch(0.7 0.18 200)",
  "oklch(0.65 0.2 60)",
];

const PRIORITY_LABEL: Record<number, string> = {
  0: "No priority",
  1: "Urgent",
  2: "High",
  3: "Medium",
  4: "Low",
};

const PRIORITY_COLOR: Record<number, string> = {
  0: "text-muted-foreground",
  1: "text-red-500",
  2: "text-orange-500",
  3: "text-yellow-500",
  4: "text-muted-foreground",
};

export function CycleBarChart({ data }: { readonly data: CycleMetric[] }) {
  const chartData = useMemo(
    () =>
      data.map((c) => ({
        label: c.name ?? `Cycle ${c.number}`,
        Scope: c.scope_history.at(-1) ?? 0,
        Completed: c.completed_scope_history.at(-1) ?? 0,
      })),
    [data],
  );

  return (
    <Card className="bg-background border-border">
      <CardHeader>
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <RefreshCw className="h-4 w-4 text-accent" />
          Cycle Scope vs Completed
        </CardTitle>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            No cycles in selected range
          </p>
        ) : (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} barGap={4}>
                <XAxis
                  dataKey="label"
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
                <Legend wrapperStyle={{ fontSize: "12px" }} iconType="square" />
                <Bar
                  dataKey="Scope"
                  fill="oklch(0.65 0.2 250)"
                  radius={[3, 3, 0, 0]}
                />
                <Bar
                  dataKey="Completed"
                  fill="oklch(0.7 0.18 140)"
                  radius={[3, 3, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function CycleHistoryChart({
  data,
  lineFilter,
}: {
  readonly data: CycleMetric[];
  readonly lineFilter: "all" | "scope" | "done" | "uncompleted";
}) {
  const [legendOpen, setLegendOpen] = useState(false);

  const lineChartData = useMemo(() => {
    const maxLen = Math.max(
      0,
      ...data.flatMap((c) => [
        c.scope_history.length,
        c.completed_scope_history.length,
      ]),
    );
    const baseDate = data.length === 1 && data[0]?.starts_at
      ? new Date(data[0].starts_at).getTime()
      : null;

    return Array.from({ length: maxLen }, (_, i) => {
      const point: Record<string, number | string> = { index: i + 1 };
      if (baseDate !== null) {
        point._date = new Date(baseDate + i * 86_400_000).toLocaleDateString(
          "en-US",
          { month: "short", day: "numeric" },
        );
      }
      data.forEach((c) => {
        const label = c.name ?? `Cycle ${c.number}`;
        if (i < c.scope_history.length)
          point[`${label} – Scope`] = c.scope_history[i] as number;
        if (i < c.completed_scope_history.length)
          point[`${label} – Done`] = c.completed_scope_history[i] as number;
      });
      return point;
    });
  }, [data]);

  return (
    <Card className="bg-background border-border">
      <CardHeader>
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <RefreshCw className="h-4 w-4 text-accent" />
          Scope &amp; Completed History
        </CardTitle>
      </CardHeader>
      <CardContent>
        {lineChartData.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            No cycles in selected range
          </p>
        ) : (
          <>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={lineChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.22 0 0)" />
                  <XAxis
                    dataKey="index"
                    label={{
                      value: "Day",
                      position: "insideBottomRight",
                      offset: -8,
                      fontSize: 11,
                      fill: "oklch(0.6 0 0)",
                    }}
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
                    labelFormatter={(v, payload) => {
                      const date = payload?.[0]?.payload?._date;
                      return date ? `Day ${v} · ${date}` : `Day ${v}`;
                    }}
                  />
                  {data.map((c, i) => {
                    const label = c.name ?? `Cycle ${c.number}`;
                    const color = CYCLE_COLORS[i % CYCLE_COLORS.length];
                    return [
                      (lineFilter === "all" || lineFilter === "scope") && (
                        <Line
                          key={`${label}-scope`}
                          type="monotone"
                          dataKey={`${label} – Scope`}
                          stroke={color}
                          strokeWidth={2}
                          dot={false}
                          connectNulls
                        />
                      ),
                      (lineFilter === "all" || lineFilter === "done") && (
                        <Line
                          key={`${label}-done`}
                          type="monotone"
                          dataKey={`${label} – Done`}
                          stroke={color}
                          strokeWidth={2}
                          strokeDasharray="4 3"
                          dot={false}
                          connectNulls
                        />
                      ),
                    ];
                  })}
                </LineChart>
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
                  {data.map((c, i) => {
                    const label = c.name ?? `Cycle ${c.number}`;
                    const color = CYCLE_COLORS[i % CYCLE_COLORS.length];
                    return (
                      <div key={label} className="flex flex-col gap-1">
                        {(lineFilter === "all" || lineFilter === "scope") && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <span style={{ display: "inline-block", width: 16, height: 2, background: color }} />
                            {label} – Scope
                          </div>
                        )}
                        {(lineFilter === "all" || lineFilter === "done") && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <svg width="16" height="4" aria-hidden>
                              <line x1="0" y1="2" x2="16" y2="2" stroke={color} strokeWidth="2" strokeDasharray="4 3" />
                            </svg>
                            {label} – Done
                          </div>
                        )}
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

export function CycleTable({ data }: { readonly data: CycleMetric[] }) {
  const sorted = [...data].sort((a, b) => a.number - b.number);

  return (
    <Card className="bg-background border-border">
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cycle #</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Scope</TableHead>
                <TableHead>Completed</TableHead>
                <TableHead>Rate</TableHead>
                <TableHead>Left open</TableHead>
                <TableHead>Carried over</TableHead>
                <TableHead>Completed At</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="text-center text-muted-foreground py-6"
                  >
                    No cycle metrics found
                  </TableCell>
                </TableRow>
              ) : (
                sorted.map((row, i) => {
                  const scope = row.scope_history.at(-1) ?? 0;
                  const completed = row.completed_scope_history.at(-1) ?? 0;
                  const rate = scope > 0 ? Math.round((completed / scope) * 100) : 0;
                  const endsAt = row.ends_at ? new Date(row.ends_at) : null;
                  const realLeftOpen = endsAt
                    ? row.uncompleted_issues_upon_close.filter(
                        (issue) => new Date(issue.addedToCycleAt) <= endsAt,
                      ).length
                    : row.uncompleted_issues_upon_close.length;

                  const prevCycle = sorted[i - 1];
                  const prevUncompletedIds = new Set(
                    (prevCycle?.uncompleted_issues_upon_close ?? []).map((issue: any) => issue.id),
                  );
                  const carryover = prevCycle
                    ? (row.cycle_issue_ids ?? []).filter((id) => prevUncompletedIds.has(id)).length
                    : null;

                  return (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{row.number}</TableCell>
                      <TableCell>{row.name ?? "—"}</TableCell>
                      <TableCell>{scope || "—"}</TableCell>
                      <TableCell>{completed || "—"}</TableCell>
                      <TableCell>
                        <span
                          className={
                            rate >= 80
                              ? "text-green-500"
                              : rate >= 50
                                ? "text-yellow-500"
                                : "text-red-500"
                          }
                        >
                          {scope > 0 ? `${rate}%` : "—"}
                        </span>
                      </TableCell>
                      <TableCell>{realLeftOpen}</TableCell>
                      <TableCell>
                        {carryover === null ? "—" : carryover > 0 ? (
                          <span className="text-yellow-500">{carryover}</span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {row.completed_at
                          ? new Date(row.completed_at).toLocaleDateString()
                          : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

export function UncompletedIssuesList({
  issues,
  cycleEndsAt,
  cycleNumber,
  prevUncompletedIds = new Set(),
}: {
  readonly issues: UncompletedIssue[];
  readonly cycleEndsAt: string | null;
  readonly cycleNumber: number;
  readonly prevUncompletedIds?: Set<string>;
}) {
  const endsAt = cycleEndsAt ? new Date(cycleEndsAt) : null;

  const realIssues = issues.filter(
    (i) => !endsAt || new Date(i.addedToCycleAt) <= endsAt,
  );
  const noiseIssues = issues.filter(
    (i) => endsAt != null && new Date(i.addedToCycleAt) > endsAt,
  );

  const sorted = [...realIssues].sort((a, b) => {
    if (a.priority === 0 && b.priority !== 0) return 1;
    if (b.priority === 0 && a.priority !== 0) return -1;
    return a.priority - b.priority;
  });

  if (issues.length === 0) return null;

  return (
    <Card className="bg-background border-border">
      <CardHeader>
        <CardTitle className="text-base font-semibold flex items-center gap-2 flex-wrap">
          <AlertCircle className="h-4 w-4 text-accent shrink-0" />
          Uncompleted at Close — Cycle #{cycleNumber}
          <span className="ml-auto text-sm font-normal text-muted-foreground">
            {realIssues.length} left open
            {noiseIssues.length > 0 && (
              <> · <span className="text-muted-foreground/60">{noiseIssues.length} added after close (excluded)</span></>
            )}
          </span>
        </CardTitle>
      </CardHeader>
      {realIssues.length === 0 ? (
        <CardContent>
          <p className="text-sm text-muted-foreground py-2">
            All issues were added after the cycle closed — nothing was genuinely left open.
          </p>
        </CardContent>
      ) : (
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Added to Cycle</TableHead>
                  <TableHead>Carried Over</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((issue) => (
                  <TableRow key={issue.id}>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {issue.number}
                    </TableCell>
                    <TableCell>{issue.title}</TableCell>
                    <TableCell
                      className={`text-xs ${PRIORITY_COLOR[issue.priority] ?? ""}`}
                    >
                      {PRIORITY_LABEL[issue.priority] ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs">
                      {issue.dueDate
                        ? new Date(issue.dueDate).toLocaleDateString()
                        : "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(issue.addedToCycleAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-xs">
                      {prevUncompletedIds.has(issue.id) ? (
                        <span className="text-yellow-500">Yes</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
