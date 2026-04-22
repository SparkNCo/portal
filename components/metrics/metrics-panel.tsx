"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { IssueMetricsView } from "./issues-metrics";
import { CycleMetricsView } from "./cycle-metrics";

type Tab = "issues" | "cycles";

interface Project {
  id: string;
  name: string;
}

export function MetricsPanel() {
  const { slug } = useParams<{ slug: string }>();
  const [tab, setTab] = useState<Tab>("issues");
  const [selectedProjectId, setSelectedProjectId] = useState("");

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
    new Map(
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

  const cycleMetrics = (data?.cycle_metrics ?? []).filter(
    (m: { project_id: string }) =>
      !activeProjectId || m.project_id === activeProjectId,
  );

  return (
    <div className="space-y-4 mb-20">
      {/* Top bar: project filter + tab toggle */}
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
        <div className="flex gap-1 rounded-lg border border-border bg-muted p-1">
          {(["issues", "cycles"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                tab === t
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "issues" ? "By Issue" : "By Cycle"}
            </button>
          ))}
        </div>
      </div>

      {tab === "issues" && (
        <IssueMetricsView data={issueMetrics} cycleMetrics={cycleMetrics} />
      )}
      {tab === "cycles" && <CycleMetricsView data={cycleMetrics} />}
    </div>
  );
}
