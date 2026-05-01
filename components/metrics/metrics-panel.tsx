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
import { CycleBarChart, CycleHistoryChart, CycleTable } from "./cycle-metrics";

type LineFilter = "all" | "scope" | "done" | "uncompleted";

interface Project {
  id: string;
  name: string;
}

export function MetricsPanel({ slug: slugProp }: { slug?: string } = {}) {
  const { profile } = useUser();
  const customerSlug = useCustomerSlug();
  const { slug: urlSlug } = useParams<{ slug: string }>();
  const slug = slugProp ?? customerSlug ?? urlSlug ?? profile?.linear_slug ?? "";

  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedCycleId, setSelectedCycleId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [lineFilter, setLineFilter] = useState<LineFilter>("all");

  const { data, isLoading, error } = useQuery({
    queryKey: ["metrics", slug],
    queryFn: async () => {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_ENDPOINT}/issueMetrics/?slug=${slug}`,
        {
          headers: {
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_APIKEY}`,
            apikey: process.env.NEXT_PUBLIC_APIKEY!,
            "Content-Type": "application/json",
          },
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

  const projects: Project[] = Array.from(
    new Map<string, Project>(
      (data?.cycle_metrics ?? [])
        .filter(
          (m: { project_id: string; project_name?: string }) => m.project_name,
        )
        .map((m: { project_id: string; project_name: string }) => [
          m.project_id,
          { id: m.project_id, name: m.project_name },
        ]),
    ).values(),
  );

  const activeProjectId = selectedProjectId || projects[0]?.id || "";

  const issueMetrics = (data?.issue_metrics ?? []).filter(
    (m: { project_id: string }) =>
      !activeProjectId || m.project_id === activeProjectId,
  );

  const allCycleMetrics = (data?.cycle_metrics ?? []).filter(
    (m: { project_id: string }) =>
      !activeProjectId || m.project_id === activeProjectId,
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

  return (
    <div className="space-y-4 mb-20">
      {/* Unified filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={activeProjectId} onValueChange={setSelectedProjectId}>
          <SelectTrigger className="w-52">
            <SelectValue placeholder="Select project" />
          </SelectTrigger>
          <SelectContent>
            {projects.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {cycles.length > 0 && (
          <Select value={activeCycleId} onValueChange={setSelectedCycleId}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Cycle" />
            </SelectTrigger>
            <SelectContent>
              {cycles.map((c: any) => (
                <SelectItem key={c.cycle_id} value={c.cycle_id}>
                  Cycle {c.number}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <label htmlFor="metrics-date-from" className="text-sm text-muted-foreground">From</label>
        <input
          id="metrics-date-from"
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <label htmlFor="metrics-date-to" className="text-sm text-muted-foreground">To</label>
        <input
          id="metrics-date-to"
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

        <div className="ml-auto flex gap-1 rounded-lg border border-border bg-muted p-1">
          {(
            [
              ["all", "All"],
              ["scope", "Scope"],
              ["done", "Done"],
              ["uncompleted", "Uncompleted"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setLineFilter(value)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                lineFilter === value
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 2-column grid: Issues by Status + Cycle Scope vs Completed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <IssueMetricsView
          data={issueMetrics}
          cycleMetrics={allCycleMetrics}
          activeCycleId={activeCycleId}
        />
        <CycleBarChart data={filteredCycleMetrics} />
      </div>

      {/* Full-width: history line chart */}
      <CycleHistoryChart data={filteredCycleMetrics} lineFilter={lineFilter} />

      {/* Full-width: table */}
      <CycleTable data={filteredCycleMetrics} />
    </div>
  );
}
