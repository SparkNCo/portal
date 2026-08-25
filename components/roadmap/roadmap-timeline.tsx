"use client";

import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { TimelineHeader, TimelineBucketsHeader } from "./TimelineHeader";
import type { TimeBucket } from "./TimelineHeader";
import { ProjectRow } from "./ProjectRow";
import type { CycleSelection } from "./ProjectRow";
import { IssueDetailModal } from "@/components/client/issue-detail-modal";
import { EditIssueModal } from "@/components/build/edit-issue-modal";
import { LABEL_ICONS } from "@/components/client/issue-cards";
import { useIssueUpdateBadge } from "@/components/client/use-issue-update-badge";
import { useUser } from "context/UserContext";
import type { Issue } from "@/components/client/issues.types";
import { API_JSON_HEADERS } from "@/lib/api-headers";
import { X, Pencil, Gauge, Search, Mail } from "lucide-react";

export type MilestoneStatus =
  | "completed"
  | "in-progress"
  | "planned"
  | "overdue"
  | "unstarted"
  | "next";

export type Milestone = {
  id: string;
  createdAt: string;
  currentProgress: {
    scopeCount: number;
    scopeEstimate: number;
    unstartedEstimate: number;
    unstartedIssueCount: number;
  };
  description: string | null;
  issues: {
    nodes: any[];
    pageInfo?: { hasNextPage: boolean; endCursor: string | null };
  };
  name: string;
  progress: number;
  progressHistory: any[];
  projectName: string;
  status: MilestoneStatus;
  targetDate: string;
};

export type RawCycle = {
  id: string;
  number: number | null;
  name: string | null;
  startsAt: string;
  endsAt: string;
  isActive?: boolean;
};

type RoadmapTimelineProps = {
  projectMilestones?: Milestone[];
  allProjectNames?: string[];
  // Maps project name -> Linear project id, so clicking a cycle can filter
  // the issues panel down to just that project (and milestone, when the
  // click came from a milestone row) instead of every issue in the cycle.
  projectIdsByName?: Record<string, string>;
  cycles?: RawCycle[];
  slug?: string;
};

function toIssue(issue: any): Issue {
  return {
    id: issue.id,
    branchName: issue.identifier ?? issue.id,
    title: issue.title ?? "Untitled",
    priorityLabel: issue.priorityLabel ?? "Low",
    state: issue.state,
    description: issue.description ?? null,
    labels: issue.labels,
  };
}

// Low -> High escalates through the orange family (lightest to most
// intense/red-leaning); Urgent stays destructive red as the tier beyond High.
const priorityColors: Record<string, string> = {
  Urgent: "bg-destructive/20 text-destructive border-destructive/30",
  High: "bg-chart-1/20 text-chart-1 border-chart-1/30",
  Medium: "bg-primary/20 text-primary border-primary/30",
  Low: "bg-chart-5/20 text-chart-5 border-chart-5/30",
  "No priority": "bg-card text-card-foreground border-muted",
};

const stateColors: Record<string, string> = {
  "needs-input": "bg-chart-1/20 text-chart-1",
  Backlog: "bg-card text-card-foreground",
  Todo: "bg-slate-500/20 text-slate-600",
  "In Progress": "bg-warning/20 text-warning",
  "In Review": "bg-blue-500/20 text-blue-600",
  Blocked: "bg-destructive/20 text-destructive",
  "Not Started": "bg-card text-card-foreground",
  Canceled: "bg-destructive/20 text-destructive",
  Cancelled: "bg-destructive/20 text-destructive",
  waiting: "bg-card text-card-foreground",
  Done: "bg-success/20 text-success",
  Completed: "bg-success/20 text-success",
  QA: "bg-blue-700/20 text-blue-700",
  "Business Review": "bg-orange-500/20 text-orange-600",
  Development: "bg-orange-500/20 text-orange-600",
  UAT: "bg-teal-500/20 text-teal-600",
  Planning: "bg-yellow-500/20 text-yellow-600",
};

// The status/priority filter buttons in "All issues in this cycle" used to
// order themselves by whatever order the API happened to return issues in —
// reusing these color maps' own key order (severity for priority, rough
// workflow order for status) instead gives a stable, predictable order that
// also matches the sequence already implied by their colors elsewhere.
const priorityOrder = Object.keys(priorityColors);
const stateOrder = Object.keys(stateColors);

function sortByFixedOrder<T extends string>(items: T[], order: string[]): T[] {
  return [...items].sort((a, b) => {
    const ai = order.indexOf(a);
    const bi = order.indexOf(b);
    return (ai === -1 ? order.length : ai) - (bi === -1 ? order.length : bi);
  });
}

export function RoadmapTimeline({
  projectMilestones = [],
  allProjectNames = [],
  projectIdsByName = {},
  cycles: rawCycles = [],
  slug = "",
}: RoadmapTimelineProps) {
  const queryClient = useQueryClient();
  const { profile } = useUser();
  const { hasUnseenUpdate } = useIssueUpdateBadge();
  const [expandedProjects, setExpandedProjects] = useState<
    Record<string, boolean>
  >({});
  const [selection, setSelection] = useState<CycleSelection | null>(null);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [editingIssue, setEditingIssue] = useState<Issue | null>(null);
  const [issueSearch, setIssueSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [priorityFilter, setPriorityFilter] = useState<string | null>(null);
  const [cycleIssues, setCycleIssues] = useState<any[]>([]);
  const [cycleIssuesLoading, setCycleIssuesLoading] = useState(false);
  const [cycleIssuesCursor, setCycleIssuesCursor] = useState<string | null>(null);
  const [hasMoreCycleIssues, setHasMoreCycleIssues] = useState(false);
  const [loadingMoreCycleIssues, setLoadingMoreCycleIssues] = useState(false);

  // Every project in an initiative typically shares one team, so cycles from
  // all of them are pooled into a single deduped, chronological list.
  const allBuckets = useMemo(() => {
    const byId = new Map<string, TimeBucket>();
    for (const c of rawCycles) {
      if (!c?.id || !c.startsAt || !c.endsAt || byId.has(c.id)) continue;
      byId.set(c.id, {
        key: c.id,
        label: c.number != null ? `#${c.number}` : (c.name ?? "Cycle"),
        start: new Date(c.startsAt),
        end: new Date(c.endsAt),
        isActive: !!c.isActive,
      });
    }
    return Array.from(byId.values()).sort(
      (a, b) => a.start.getTime() - b.start.getTime(),
    );
  }, [rawCycles]);

  const WINDOW_SIZE = 5; // 2 before + current + 2 after

  // Defaults to centering on the active cycle (2 before, current, 2 after);
  // the arrows shift this window across the rest of the fetched history.
  const [windowStart, setWindowStart] = useState<number | null>(null);

  useEffect(() => {
    if (allBuckets.length === 0) return;
    const activeIndex = allBuckets.findIndex((b) => b.isActive);
    const center = activeIndex >= 0 ? activeIndex : allBuckets.length - 1;
    const start = Math.max(0, Math.min(center - 2, allBuckets.length - WINDOW_SIZE));
    setWindowStart(start);
    // Only re-center when the underlying cycle list itself changes — not on
    // every render, which would fight the arrow buttons.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawCycles]);

  const effectiveWindowStart = windowStart ?? 0;
  const buckets = useMemo(
    () => allBuckets.slice(effectiveWindowStart, effectiveWindowStart + WINDOW_SIZE),
    [allBuckets, effectiveWindowStart],
  );
  const canGoBack = effectiveWindowStart > 0;
  const canGoForward = effectiveWindowStart + WINDOW_SIZE < allBuckets.length;

  // Seed every known project (even ones with zero milestones) so they still
  // render a row — projects only ever get into `projectMilestones` via a
  // milestone, so without this a project with no milestones yet would simply
  // never appear in the timeline at all.
  const groupedMilestones = useMemo(() => {
    const seeded: Record<string, Milestone[]> = {};
    for (const name of allProjectNames) {
      seeded[name] = [];
    }

    return projectMilestones.reduce((acc: Record<string, Milestone[]>, m) => {
      const key = m.projectName ?? "Unknown Project";
      acc[key] ??= [];
      acc[key].push(m);
      return acc;
    }, seeded);
  }, [projectMilestones, allProjectNames]);

  const sortedProjectEntries = useMemo(
    () => Object.entries(groupedMilestones).sort(([a], [b]) => a.localeCompare(b)),
    [groupedMilestones],
  );

  const selectedBucket = useMemo(
    () => (selection ? buckets.find((b) => b.key === selection.cycleKey) ?? null : null),
    [selection, buckets],
  );

  // Builds the query for GET /roadmap: a specific cycle when one was
  // clicked, or — when the project/milestone itself was clicked directly —
  // every issue under it with no cycle restriction at all (the edge
  // function branches on cycleId's absence to fetch that way).
  function buildIssuesParams(sel: CycleSelection, after?: string | null) {
    const params = new URLSearchParams();
    if (sel.cycleKey) params.set("cycleId", sel.cycleKey);
    if (sel.projectId) params.set("projectId", sel.projectId);
    if (sel.milestoneId) params.set("milestoneId", sel.milestoneId);
    if (after) params.set("after", after);
    return params;
  }

  // Fetches the real, complete set of issues in the clicked cycle (or, with
  // no cycle selected, the whole project/milestone) directly from Linear
  // (team-wide) rather than pooling whatever happened to already be loaded
  // via project milestones.
  useEffect(() => {
    if (!selection) {
      setCycleIssues([]);
      setCycleIssuesCursor(null);
      setHasMoreCycleIssues(false);
      return;
    }

    let cancelled = false;
    setIssueSearch("");
    setStatusFilter(null);
    setPriorityFilter(null);
    setCycleIssuesLoading(true);

    const params = buildIssuesParams(selection);

    fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/roadmap?${params.toString()}`,
      { headers: API_JSON_HEADERS },
    )
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch cycle issues");
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        setCycleIssues(data.nodes ?? []);
        setCycleIssuesCursor(data.pageInfo?.endCursor ?? null);
        setHasMoreCycleIssues(data.pageInfo?.hasNextPage ?? false);
      })
      .catch((err) => {
        console.error("Failed to load cycle issues:", err);
        if (!cancelled) {
          setCycleIssues([]);
          setHasMoreCycleIssues(false);
        }
      })
      .finally(() => {
        if (!cancelled) setCycleIssuesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selection?.cycleKey, selection?.projectId, selection?.milestoneId]);

  async function handleLoadMoreCycleIssues() {
    if (!selection || loadingMoreCycleIssues) return;
    setLoadingMoreCycleIssues(true);
    try {
      const params = buildIssuesParams(selection, cycleIssuesCursor);
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/roadmap?${params.toString()}`,
        { headers: API_JSON_HEADERS },
      );
      if (!res.ok) throw new Error("Failed to load more issues");
      const data = await res.json();
      setCycleIssues((prev) => [...prev, ...(data.nodes ?? [])]);
      setHasMoreCycleIssues(data.pageInfo?.hasNextPage ?? false);
      setCycleIssuesCursor(data.pageInfo?.endCursor ?? null);
    } catch (err) {
      console.error("Failed to load more cycle issues:", err);
    } finally {
      setLoadingMoreCycleIssues(false);
    }
  }

  const availableStatuses = useMemo(
    () =>
      sortByFixedOrder(
        Array.from(new Set(cycleIssues.map((i) => i.state?.name).filter(Boolean))),
        stateOrder,
      ),
    [cycleIssues],
  );
  const availablePriorities = useMemo(
    () =>
      sortByFixedOrder(
        Array.from(new Set(cycleIssues.map((i) => i.priorityLabel).filter(Boolean))),
        priorityOrder,
      ),
    [cycleIssues],
  );

  const visibleIssues = cycleIssues.filter((issue) => {
    if (statusFilter && issue.state?.name !== statusFilter) return false;
    if (priorityFilter && issue.priorityLabel !== priorityFilter) return false;
    if (issueSearch.trim()) {
      const q = issueSearch.toLowerCase();
      const matchesTitle = issue.title?.toLowerCase().includes(q);
      const matchesIdentifier = issue.identifier?.toLowerCase().includes(q);
      if (!matchesTitle && !matchesIdentifier) return false;
    }
    return true;
  });

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden bg-background text-foreground">
        <TimelineHeader
          onPrev={() => setWindowStart((w) => Math.max(0, (w ?? 0) - 1))}
          onNext={() =>
            setWindowStart((w) =>
              Math.max(0, Math.min(allBuckets.length - WINDOW_SIZE, (w ?? 0) + 1)),
            )
          }
          canGoBack={canGoBack}
          canGoForward={canGoForward}
        />

        <CardContent className="overflow-x-auto px-2 sm:px-6">
          <div className="min-w-0 sm:min-w-[560px]">
            {allBuckets.length === 0 ? (
              <p className="py-6 text-center smalltext text-muted-foreground">
                No cycles found for this team.
              </p>
            ) : (
              <>
                <TimelineBucketsHeader buckets={buckets} />
                {sortedProjectEntries.map(([projectName, milestones]) => (
                  <ProjectRow
                    key={projectName}
                    projectName={projectName}
                    projectId={projectIdsByName[projectName] ?? null}
                    milestones={milestones}
                    buckets={buckets}
                    expanded={!!expandedProjects[projectName]}
                    onToggle={() =>
                      setExpandedProjects((p) => ({
                        ...p,
                        [projectName]: !p[projectName],
                      }))
                    }
                    selection={selection}
                    onCycleSelect={(next) =>
                      setSelection((prev) =>
                        prev &&
                        prev.projectName === next.projectName &&
                        prev.milestoneName === next.milestoneName &&
                        prev.cycleKey === next.cycleKey
                          ? null
                          : next,
                      )
                    }
                  />
                ))}

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-4 pt-3 border-t border-border smalltext text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-success" />
                    Completed
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-primary/50" />
                    In progress
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-[hsl(180,60%,50%)]/50" />
                    Next
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-[hsl(210,70%,55%)]/50" />
                    Planned
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-[hsl(43,74%,66%)]/50" />
                    Unstarted
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-destructive/50" />
                    Overdue
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-card/50 border border-border" />
                    No issues in this cycle
                  </span>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {selection && (
        <Card className="bg-background text-foreground">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="body font-semibold">
                  {selectedBucket ? (
                    <>
                      {selectedBucket.label}
                      <span className="ml-2 smalltext font-normal text-muted-foreground">
                        {selectedBucket.start.toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}{" "}
                        –{" "}
                        {selectedBucket.end.toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                    </>
                  ) : (
                    selection.milestoneName ?? selection.projectName
                  )}
                </h3>
                <p className="smalltext text-muted-foreground">
                  {selectedBucket
                    ? "All issues in this cycle"
                    : selection.milestoneName
                      ? "Every issue in this milestone, across all cycles"
                      : "Every issue in this project, across all cycles"}
                  {" · opened from "}
                  {selection.projectName}
                  {selection.milestoneName ? ` · ${selection.milestoneName}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelection(null)}
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Close cycle details"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {cycleIssuesLoading ? (
              <p className="smalltext text-muted-foreground">Loading issues...</p>
            ) : cycleIssues.length === 0 ? (
              <p className="smalltext text-muted-foreground">
                {selectedBucket ? "No issues in this cycle." : "No issues found."}
              </p>
            ) : (
              <>
                <div className="flex flex-col gap-2 mb-4 sm:flex-row sm:items-center sm:flex-wrap">
                  <div className="relative flex-1 sm:max-w-[220px]">
                    <Search className="absolute left-2.5 top-1/2 z-10 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                    <Input
                      type="text"
                      aria-label="Search by title or ID"
                      placeholder="Search by title or ID..."
                      value={issueSearch}
                      onChange={(e) => setIssueSearch(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                  {availableStatuses.length > 0 && (
                    <div className="flex gap-1.5 flex-wrap">
                      {availableStatuses.map((status) => (
                        <button
                          key={status}
                          onClick={() =>
                            setStatusFilter((prev) => (prev === status ? null : status))
                          }
                          className={`smalltext px-2.5 py-1 rounded-md border font-medium transition-all ${
                            statusFilter === status
                              ? `${stateColors[status] ?? "bg-muted text-foreground"} border-current`
                              : "bg-muted/40 text-muted-foreground border-border hover:bg-muted"
                          }`}
                        >
                          {status}
                        </button>
                      ))}
                    </div>
                  )}
                  {availablePriorities.length > 0 && (
                    <div className="flex gap-1.5 flex-wrap">
                      {availablePriorities.map((priority) => (
                        <button
                          key={priority}
                          onClick={() =>
                            setPriorityFilter((prev) => (prev === priority ? null : priority))
                          }
                          className={`smalltext px-2.5 py-1 rounded-md border font-medium transition-all ${
                            priorityFilter === priority
                              ? `${priorityColors[priority] ?? "bg-muted text-foreground"} border-current`
                              : "bg-muted/40 text-muted-foreground border-border hover:bg-muted"
                          }`}
                        >
                          {priority}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {visibleIssues.length === 0 ? (
                  <p className="smalltext text-muted-foreground">
                    No issues match the current filters.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {visibleIssues.map((issue: any, i: number) => {
                  const typeLabel = issue.labels?.nodes?.find(
                    (l: any) => LABEL_ICONS[l.name.toLowerCase()],
                  );
                  const typeIcon = typeLabel ? LABEL_ICONS[typeLabel.name.toLowerCase()] : undefined;
                  const otherLabels = issue.labels?.nodes?.filter(
                    (l: any) => l.id !== typeLabel?.id,
                  );

                  return (
                  <div
                    key={issue.id ?? i}
                    className="group relative rounded-md border light-card p-3 space-y-2"
                  >
                    <button
                      type="button"
                      className="absolute inset-0 rounded-md cursor-pointer"
                      onClick={() => setSelectedIssue(toIssue(issue))}
                      aria-label={issue.title ?? "View issue"}
                    />
                    {hasUnseenUpdate(issue, profile?.email) && (
                      <span
                        className="absolute -top-2 -right-2 z-10 flex h-4 w-4 items-center justify-center rounded-full bg-orange-500 ring-2 ring-background"
                        title="Recently updated"
                      >
                        <Mail className="h-2.5 w-2.5 text-white" />
                      </span>
                    )}
                    <button
                      type="button"
                      className="absolute top-2 right-2 z-10 p-1.5 rounded-md light-card-chip opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingIssue(toIssue(issue));
                      }}
                      aria-label="Edit ticket"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    {(issue.identifier || issue.title) && (
                      <div className="space-y-0.5">
                        {issue.identifier && (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="flex items-center gap-1 smalltext light-card-muted font-mono">
                              {typeIcon && (
                                <typeIcon.Icon
                                  className={`h-3 w-3 shrink-0 ${typeIcon.className}`}
                                  aria-label={typeLabel.name}
                                />
                              )}
                              {issue.identifier}
                            </p>
                            {issue.priorityLabel &&
                              issue.priorityLabel !== "No priority" && (
                                <Badge
                                  variant="outline"
                                  className={`smalltext ${priorityColors[issue.priorityLabel] ?? ""}`}
                                >
                                  {issue.priorityLabel}
                                </Badge>
                              )}
                          </div>
                        )}
                        {issue.title && (
                          <p className="smalltext font-medium leading-snug light-card-text">{issue.title}</p>
                        )}
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {issue.estimate != null && (
                        <Badge
                          variant="outline"
                          className="gap-1 smalltext border-chart-1/30 bg-chart-1/10 text-chart-1"
                        >
                          <Gauge className="h-3 w-3" />
                          {issue.estimate}
                        </Badge>
                      )}
                      {issue.state?.name && (
                        <Badge
                          variant="outline"
                          className={`smalltext ${stateColors[issue.state.name] ?? "bg-muted border-border text-muted-foreground"}`}
                        >
                          {issue.state.name}
                        </Badge>
                      )}
                    </div>

                    {otherLabels?.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {otherLabels.map((l: any) => (
                          <span
                            key={l.name}
                            className="smalltext bg-muted rounded px-1.5 py-0.5 text-muted-foreground"
                          >
                            {l.name}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="space-y-0.5">
                      {issue.assignee?.displayName && (
                        <p className="smalltext light-card-muted">
                          Assignee:{" "}
                          <span className="light-card-text">
                            {issue.assignee.displayName}
                          </span>
                        </p>
                      )}
                      {issue.dueDate && (
                        <p className="smalltext light-card-muted">
                          Due:{" "}
                          <span className="light-card-text">
                            {new Date(issue.dueDate).toLocaleDateString()}
                          </span>
                        </p>
                      )}
                      {issue.completedAt && (
                        <p className="smalltext light-card-muted">
                          Completed:{" "}
                          <span className="text-success">
                            {new Date(issue.completedAt).toLocaleDateString()}
                          </span>
                        </p>
                      )}
                    </div>
                  </div>
                  );
                })}
                  </div>
                )}

                {hasMoreCycleIssues && (
                  <div className="flex justify-center mt-3">
                    <button
                      type="button"
                      onClick={handleLoadMoreCycleIssues}
                      disabled={loadingMoreCycleIssues}
                      className="smalltext px-3 py-1.5 rounded-md border border-border bg-muted/40 text-muted-foreground hover:bg-muted disabled:opacity-50"
                    >
                      {loadingMoreCycleIssues ? "Loading..." : "Load more issues"}
                    </button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}
      {selectedIssue && (
        <IssueDetailModal
          issue={selectedIssue}
          slug={slug}
          onClose={() => setSelectedIssue(null)}
        />
      )}
      {editingIssue && (
        <EditIssueModal
          issue={editingIssue}
          slug={slug}
          onClose={() => setEditingIssue(null)}
          onSaved={() => queryClient.invalidateQueries({ queryKey: ["roadmap", slug] })}
        />
      )}
    </div>
  );
}
