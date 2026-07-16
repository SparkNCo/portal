"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useUser } from "context/UserContext";
import { useCustomerSlug } from "context/CustomerSlugContext";
import { useParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { IssueMetricsView } from "./issues-metrics";
import {
  CycleBarChart,
  CycleHistoryChart,
  CycleTable,
  UncompletedIssuesList,
} from "./cycle-metrics";
import { API_JSON_HEADERS } from "@/lib/api-headers";

type LineFilter = "all" | "scope" | "done";

interface Project {
  name: string;
}

export function MetricsPanel({ slug: slugProp }: { slug?: string } = {}) {
  const { profile } = useUser();
  const customerSlug = useCustomerSlug();
  const { slug: urlSlug } = useParams<{ slug: string }>();
  const slug =
    slugProp ?? customerSlug ?? urlSlug ?? profile?.linear_slug ?? "";

  const [selectedProjectName, setSelectedProjectName] = useState("");
  const [selectedCycleId, setSelectedCycleId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [lineFilter, setLineFilter] = useState<LineFilter>("all");
  // Tracks which control the user touched last, so "Issues by Status" knows
  // whether to stay scoped to the picked cycle or span every cycle the date
  // range covers — only a direct edit to the date inputs should trigger the
  // latter, not the date fields being auto-filled by picking a cycle.
  const [lastFilterTouched, setLastFilterTouched] = useState<"cycle" | "date" | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["metrics", slug],
    queryFn: async () => {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/issueMetrics/?slug=${slug}`,
        {
          headers: API_JSON_HEADERS,
        },
      );
      if (!res.ok) throw new Error("Failed to fetch metrics");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <p className="text-sm text-muted-foreground py-4">Loading metrics…</p>
    );
  }

  if (error) {
    return (
      <p className="text-sm text-destructive py-4">Failed to load metrics</p>
    );
  }

  const projectNames: string[] = Array.from(
    new Set(
      (data?.cycle_metrics ?? [])
        .map((m: { project_name?: string }) => m.project_name)
        .filter((name: string | undefined): name is string => Boolean(name)),
    ),
  );
  const projects: Project[] = projectNames.map((name) => ({ name }));

  const activeProjectName = selectedProjectName || projects[0]?.name || "";

  // issue_metrics rows only carry project_id (no project_name), so derive
  // which project_ids belong to the selected project's name via cycle_metrics.
  const projectIdsForActiveName = new Set(
    (data?.cycle_metrics ?? [])
      .filter((m: { project_name?: string }) => m.project_name === activeProjectName)
      .map((m: { project_id: string }) => m.project_id),
  );

  const issueMetrics = (data?.issue_metrics ?? []).filter(
    (m: { project_id: string }) =>
      !activeProjectName || projectIdsForActiveName.has(m.project_id),
  );

  const allCycleMetrics = (data?.cycle_metrics ?? []).filter(
    (m: { project_id: string }) =>
      !activeProjectName || projectIdsForActiveName.has(m.project_id),
  );

  const cycles = [...allCycleMetrics].sort(
    (a: { number: number }, b: { number: number }) => a.number - b.number,
  );
  const activeCycleId = selectedCycleId || cycles.at(-1)?.cycle_id || "";

  const filteredCycleMetrics = allCycleMetrics.filter((c: any) => {
    const start = c.starts_at ? new Date(c.starts_at) : null;
    const end = c.ends_at ? new Date(c.ends_at) : null;
    const from = dateFrom ? new Date(dateFrom) : null;
    const to = dateTo ? new Date(dateTo + "T23:59:59") : null;
    if (from && end && end < from) return false;
    if (to && start && start > to) return false;
    return true;
  });

  // The user's last direct edit was the date range, not the cycle picker —
  // treat that as "show me everything in this range", spanning every cycle
  // it covers, rather than staying pinned to a single selected cycle.
  const spanAllCycles =
    lastFilterTouched === "date" && !!(dateFrom || dateTo);
  return (
    <div className="space-y-4 mb-20">
      {/* Unified filter bar */}
      <div
        className="flex flex-wrap items-center gap-3 
"
      >
        <Select value={activeProjectName} onValueChange={setSelectedProjectName}>
          <SelectTrigger className="w-52">
            <SelectValue placeholder="Select project" />
          </SelectTrigger>
          <SelectContent>
            {projects.map((p) => (
              <SelectItem key={p.name} value={p.name}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {cycles.length > 0 && (
          <Select
            value={activeCycleId}
            onValueChange={(id) => {
              setLastFilterTouched("cycle");
              setSelectedCycleId(id);
              const cycle = cycles.find((c: any) => c.cycle_id === id);
              if (cycle?.starts_at) setDateFrom(String(cycle.starts_at).split("T")[0] ?? "");
              if (cycle?.ends_at) setDateTo(String(cycle.ends_at).split("T")[0] ?? "");
            }}
          >
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Cycle" />
            </SelectTrigger>
            <SelectContent>
              {[...cycles].reverse().map((c: any) => (
                <SelectItem key={c.cycle_id} value={c.cycle_id}>
                  Cycle {c.number}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <div className="flex items-center gap-2">
            <label
              htmlFor="metrics-date-from"
              className="text-sm text-muted-foreground w-8"
            >
              From
            </label>
            <input
              id="metrics-date-from"
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setLastFilterTouched("date");
                setDateFrom(e.target.value);
              }}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div className="flex items-center gap-2">
            <label
              htmlFor="metrics-date-to"
              className="text-sm text-muted-foreground w-8"
            >
              To
            </label>
            <input
              id="metrics-date-to"
              type="date"
              value={dateTo}
              onChange={(e) => {
                setLastFilterTouched("date");
                setDateTo(e.target.value);
              }}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </div>
        {(dateFrom || dateTo) && (
          <button
            onClick={() => {
              setDateFrom("");
              setDateTo("");
              setLastFilterTouched(null);
            }}
            className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            Clear
          </button>
        )}

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CycleBarChart data={filteredCycleMetrics} />
        <IssueMetricsView
          data={issueMetrics}
          cycleMetrics={filteredCycleMetrics}
          activeCycleId={activeCycleId}
          dateFrom={dateFrom}
          dateTo={dateTo}
          spanAllCycles={spanAllCycles}
        />
      </div>

    </div>
  );
}
