"use client";

import { useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
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
import { RefreshCw } from "lucide-react";

interface CycleMetric {
  id: string;
  cycle_id: string;
  name: string | null;
  number: number;
  description: string | null;
  completed_at: string | null;
  scope_history: number[];
  completed_scope_history: number[];
  uncompleted_issues_upon_close: any[];
  created_at: string;
}

export function CycleMetricsView({ data }: { readonly data: CycleMetric[] }) {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const filtered = useMemo(() => {
    return data.filter((c) => {
      const d = new Date(c.created_at);
      if (dateFrom && d < new Date(dateFrom)) return false;
      if (dateTo && d > new Date(dateTo + "T23:59:59")) return false;
      return true;
    });
  }, [data, dateFrom, dateTo]);

  const chartData = useMemo(
    () =>
      filtered.map((c) => ({
        label: c.name ?? `Cycle ${c.number}`,
        Scope: c.scope_history.at(-1) ?? 0,
        Completed: c.completed_scope_history.at(-1) ?? 0,
      })),
    [filtered],
  );

  return (
    <div className="space-y-4">
      {/* Date range filter */}
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm text-muted-foreground">From</label>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <label className="text-sm text-muted-foreground">To</label>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
        {(dateFrom || dateTo) && (
          <button
            onClick={() => {
              setDateFrom("");
              setDateTo("");
            }}
            className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            Clear
          </button>
        )}
      </div>

      {/* Chart */}
      <Card className="bg-background border-border">
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-accent" />
            Cycle Scope vs Completed
          </CardTitle>
        </CardHeader>

        <div onClick={() => console.log({chartData})}>VER chartData</div>

        <CardContent>
          {chartData.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No cycles in selected range
            </p>
          ) : (
            <div className="h-64">
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
                  <Legend
                    wrapperStyle={{ fontSize: "12px" }}
                    iconType="square"
                  />
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

      {/* Table */}
      <Card className="bg-background border-border">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cycle #</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Scope (latest)</TableHead>
                  <TableHead>Completed (latest)</TableHead>
                  <TableHead>Uncompleted on Close</TableHead>
                  <TableHead>Completed At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center text-muted-foreground py-6"
                    >
                      No cycle metrics found
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">
                        {row.number}
                      </TableCell>
                      <TableCell>{row.name ?? "—"}</TableCell>
                      <TableCell>{row.scope_history.at(-1) ?? "—"}</TableCell>
                      <TableCell>
                        {row.completed_scope_history.at(-1) ?? "—"}
                      </TableCell>
                      <TableCell>
                        {row.uncompleted_issues_upon_close.length}
                      </TableCell>
                      <TableCell>
                        {row.completed_at
                          ? new Date(row.completed_at).toLocaleDateString()
                          : "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
