"use client";

import { useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { BarChart2 } from "lucide-react";

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

const LINE_COLORS = [
  "oklch(0.65 0.2 250)",
  "oklch(0.7 0.18 140)",
  "oklch(0.7 0.2 30)",
  "oklch(0.65 0.2 0)",
  "oklch(0.65 0.15 300)",
  "oklch(0.7 0.15 200)",
];

export function IssueMetricsView({ data }: { readonly data: IssueMetric[] }) {
  const [selectedLabel, setSelectedLabel] = useState("all");
  const [metric, setMetric] = useState<"count" | "points">("count");

  const uniqueLabels = useMemo(
    () => ["all", ...Array.from(new Set(data.map((d) => d.label)))],
    [data],
  );

  const today = new Date().toISOString().split("T")[0];

  const filtered = useMemo(
    () =>
      data.filter(
        (d) => selectedLabel === "all" || d.label === selectedLabel,
      ),
    [data, selectedLabel],
  );

  const todayRows = useMemo(
    () => filtered.filter((d) => d.created_at.slice(0, 10) === today),
    [filtered, today],
  );

  const uniqueStatuses = useMemo(
    () => Array.from(new Set(filtered.map((d) => d.status))).sort(),
    [filtered],
  );

  const uniqueDates = useMemo(
    () =>
      Array.from(new Set(filtered.map((d) => d.created_at.slice(0, 10)))).sort(),
    [filtered],
  );

  const chartData = useMemo(
    () =>
      uniqueDates.map((date) => {
        const row: Record<string, string | number> = { date };
        for (const status of uniqueStatuses) {
          row[status] = filtered
            .filter((d) => d.created_at.slice(0, 10) === date && d.status === status)
            .reduce((sum, d) => sum + d[metric], 0);
        }
        return row;
      }),
    [uniqueDates, uniqueStatuses, filtered, metric],
  );

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div onClick={() => console.log({issueMetrics})}>VER chartData</div>
      
      <div className="flex flex-wrap gap-3">
        <Select value={selectedLabel} onValueChange={setSelectedLabel}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Label" />
          </SelectTrigger>
          <SelectContent>
            {uniqueLabels.map((l) => (
              <SelectItem key={l} value={l}>
                {l === "all" ? "All labels" : l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={metric}
          onValueChange={(v) => setMetric(v as "count" | "points")}
        >
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="count">By count</SelectItem>
            <SelectItem value="points">By points</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Chart */}
      <Card className="bg-background border-border">
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <BarChart2 className="h-4 w-4 text-accent" />
            Issues — {metric === "count" ? "Count" : "Points"} by Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No data
            </p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
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
                  <Legend
                    wrapperStyle={{ fontSize: "12px" }}
                    iconType="circle"
                  />
                  {uniqueStatuses.map((status, i) => (
                    <Line
                      key={status}
                      type="monotone"
                      dataKey={status}
                      stroke={LINE_COLORS[i % LINE_COLORS.length]}
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  ))}
                </LineChart>
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
                  <TableHead>Status</TableHead>
                  <TableHead>Label</TableHead>
                  <TableHead>Count</TableHead>
                  <TableHead>Points</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Title</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {todayRows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center text-muted-foreground py-6"
                    >
                      No issue metrics found
                    </TableCell>
                  </TableRow>
                ) : (
                  todayRows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <Badge variant="outline">{row.status}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {row.label}
                      </TableCell>
                      <TableCell>{row.count}</TableCell>
                      <TableCell>{row.points}</TableCell>
                      <TableCell>{row.created_at.slice(0, 10)}</TableCell>
                      <TableCell className="max-w-xs">
                        {row.title && (
                          <span className="text-xs text-muted-foreground truncate block">
                            {row.title}
                          </span>
                        )}
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
