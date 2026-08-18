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
import { safeDecodeURIComponent } from "@/lib/utils";

type LineFilter = "all" | "scope" | "done";

interface Project {
  name: string;
}

const ALL_PROJECTS_VALUE = "__all_projects__";
const ALL_CYCLES_VALUE = "__all_cycles__";

export function MetricsPanel({ slug: slugProp }: { slug?: string } = {}) {
  const { profile } = useUser();
  const customerSlug = useCustomerSlug();
  const { slug: rawUrlSlug } = useParams<{ slug: string }>();
  const urlSlug = rawUrlSlug ? safeDecodeURIComponent(rawUrlSlug) : rawUrlSlug;
  const slug =
    slugProp ?? customerSlug ?? urlSlug ?? profile?.linear_slug ?? "";

  const [selectedProjectName, setSelectedProjectName] = useState("");
  // Keyed by cycle *number*, not cycle_id — with "All Projects" selected,
  // every project has its own row for "Cycle 13", so number is the only key
  // that lets one dropdown entry represent all of them at once.
  const [selectedCycleNumber, setSelectedCycleNumber] = useState("");
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
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/issueMetrics/?slug=${encodeURIComponent(slug)}`,
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
      <p className="smalltext text-muted-foreground py-4">Loading metrics…</p>
    );
  }

  if (error) {
    return (
      <p className="smalltext text-destructive py-4">Failed to load metrics</p>
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

  // The Select needs a non-empty sentinel to represent "All Projects" (Radix
  // Select reserves value="" for its own placeholder state) — the actual
  // filtering below already treats an empty activeProjectName as "no
  // filter", so the sentinel just gets mapped back to "" before it's used.
  const selectedProjectValue = selectedProjectName || projects[0]?.name || "";
  const activeProjectName =
    selectedProjectValue === ALL_PROJECTS_VALUE ? "" : selectedProjectValue;

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

  // De-duplicated for the dropdown — "All Projects" mode has one cycle_metrics
  // row per project per number, but should only offer "Cycle 13" once.
  const cycleNumbers = Array.from(new Set(cycles.map((c: any) => c.number))).sort(
    (a, b) => (a as number) - (b as number),
  ) as number[];

  // A previously-picked cycle number can stop existing after switching
  // projects (or "All Projects") — fall back to the latest cycle in the new
  // scope instead of pinning to a number that no longer has any data.
  const selectedCycleStillExists =
    selectedCycleNumber !== "" && cycleNumbers.includes(Number(selectedCycleNumber));
  const activeCycleNumber = selectedCycleStillExists
    ? selectedCycleNumber
    : String(cycles.at(-1)?.number ?? "");

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

  // Shared by the "Cycle" dropdown and clicking a bar directly on "Cycle
  // Scope vs Completed" — both apply the same cycle number as the filter,
  // which "Issues by Status" reads via activeCycleNumber. When multiple
  // projects are in scope (All Projects), the date range spans every
  // project's cycle with this number, and the merge in IssueMetricsView
  // combines their issue data together.
  function selectCycle(numberStr: string) {
    setLastFilterTouched("cycle");
    setSelectedCycleNumber(numberStr);
    const matches = cycles.filter((c: any) => String(c.number) === numberStr);
    const starts = matches.map((c: any) => c.starts_at).filter(Boolean).map((d: string) => new Date(d).getTime());
    const ends = matches.map((c: any) => c.ends_at).filter(Boolean).map((d: string) => new Date(d).getTime());
    if (starts.length) setDateFrom(new Date(Math.min(...starts)).toISOString().split("T")[0] ?? "");
    if (ends.length) setDateTo(new Date(Math.max(...ends)).toISOString().split("T")[0] ?? "");
  }

  // Spans the date range across every cycle the selected project has, rather
  // than one at a time — sets From/To to the earliest cycle's start and the
  // latest cycle's end, and clears any single-cycle selection so nothing
  // stays pinned.
  function showAllCycles() {
    const starts = cycles
      .map((c: any) => c.starts_at)
      .filter(Boolean)
      .map((d: string) => new Date(d).getTime());
    const ends = cycles
      .map((c: any) => c.ends_at)
      .filter(Boolean)
      .map((d: string) => new Date(d).getTime());
    if (!starts.length || !ends.length) return;

    setSelectedCycleNumber("");
    setDateFrom(new Date(Math.min(...starts)).toISOString().split("T")[0] ?? "");
    setDateTo(new Date(Math.max(...ends)).toISOString().split("T")[0] ?? "");
    setLastFilterTouched("date");
  }

  // Shared by the "Cycle" dropdown's "All Cycles" entry and the "Show all
  // cycles" button on the bar chart — both just call showAllCycles().
  function handleCycleSelect(value: string) {
    if (value === ALL_CYCLES_VALUE) {
      showAllCycles();
    } else {
      selectCycle(value);
    }
  }

  return (
    <div className="space-y-4 mb-20">
      {/* Unified filter bar */}
      <div
        className="flex flex-wrap items-center gap-3 
"
      >
        <Select value={selectedProjectValue} onValueChange={setSelectedProjectName}>
          <SelectTrigger className="w-52 smalltext">
            <SelectValue placeholder="Select project" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_PROJECTS_VALUE} className="smalltext focus:text-primary">
              All Projects
            </SelectItem>
            {projects.map((p) => (
              <SelectItem key={p.name} value={p.name} className="smalltext focus:text-primary">
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {cycleNumbers.length > 0 && (
          <Select
            value={spanAllCycles ? ALL_CYCLES_VALUE : activeCycleNumber}
            onValueChange={handleCycleSelect}
          >
            <SelectTrigger className="w-36 smalltext">
              <SelectValue placeholder="Cycle" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_CYCLES_VALUE} className="smalltext focus:text-primary">
                All Cycles
              </SelectItem>
              {[...cycleNumbers].reverse().map((number) => (
                <SelectItem key={number} value={String(number)} className="smalltext focus:text-primary">
                  Cycle {number}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <div className="flex items-center gap-2">
            <label
              htmlFor="metrics-date-from"
              className="smalltext text-muted-foreground w-8"
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
              className="h-9 rounded-md border border-input bg-background px-3 smalltext text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div className="flex items-center gap-2">
            <label
              htmlFor="metrics-date-to"
              className="smalltext text-muted-foreground w-8"
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
              className="h-9 rounded-md border border-input bg-background px-3 smalltext text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
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
            className="smalltext text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            Clear
          </button>
        )}

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CycleBarChart
          data={filteredCycleMetrics}
          activeCycleNumber={spanAllCycles ? undefined : activeCycleNumber}
          onCycleClick={selectCycle}
          onShowAllCycles={cycles.length > 0 ? showAllCycles : undefined}
        />
        <IssueMetricsView
          data={issueMetrics}
          cycleMetrics={filteredCycleMetrics}
          activeCycleNumber={activeCycleNumber}
          dateFrom={dateFrom}
          dateTo={dateTo}
          spanAllCycles={spanAllCycles}
        />
      </div>

    </div>
  );
}
