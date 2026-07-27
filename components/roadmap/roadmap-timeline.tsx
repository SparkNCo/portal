"use client";

import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { TimelineHeader, TimelineMonthsHeader } from "./TimelineHeader";
import { ProjectRow } from "./ProjectRow";
import { IssueDetailModal } from "@/components/client/issue-detail-modal";
import { EditIssueModal } from "@/components/build/edit-issue-modal";
import { LABEL_ICONS } from "@/components/client/issue-cards";
import type { Issue } from "@/components/client/issues.types";
import { API_JSON_HEADERS } from "@/lib/api-headers";
import { X, Pencil, Gauge, Search } from "lucide-react";

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

type RoadmapTimelineProps = {
  projectMilestones?: Milestone[];
  allProjectNames?: string[];
  projectStartDates?: Record<string, string | null>;
  rawData?: unknown;
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
  };
}

const priorityColors: Record<string, string> = {
  Urgent: "bg-destructive/20 text-destructive border-destructive/30",
  High: "bg-warning/20 text-warning border-warning/30",
  Medium: "bg-accent/20 text-accent border-accent/30",
  Low: "bg-muted/50 text-muted-foreground border-muted",
  "No priority": "bg-muted/50 text-muted-foreground border-muted",
};

const stateColors: Record<string, string> = {
  "needs-input": "bg-chart-1/20 text-chart-1",
  Backlog: "bg-muted/50 text-muted-foreground",
  Todo: "bg-slate-500/20 text-slate-600",
  "In Progress": "bg-warning/20 text-warning",
  "In Review": "bg-blue-500/20 text-blue-600",
  Blocked: "bg-destructive/20 text-destructive",
  "Not Started": "bg-muted/50 text-muted-foreground",
  Canceled: "bg-destructive/20 text-destructive",
  Cancelled: "bg-destructive/20 text-destructive",
  waiting: "bg-muted text-muted-foreground",
  Done: "bg-success/20 text-success",
  Completed: "bg-success/20 text-success",
  QA: "bg-blue-700/20 text-blue-700",
  "Business Review": "bg-orange-500/20 text-orange-600",
  Development: "bg-orange-500/20 text-orange-600",
  UAT: "bg-teal-500/20 text-teal-600",
  Planning: "bg-yellow-500/20 text-yellow-600",
};

export function RoadmapTimeline({
  projectMilestones = [],
  allProjectNames = [],
  projectStartDates = {},
  rawData,
  slug = "",
}: RoadmapTimelineProps) {
  const queryClient = useQueryClient();
  const [expandedProjects, setExpandedProjects] = useState<
    Record<string, boolean>
  >({});
  const [selectedMilestone, setSelectedMilestone] = useState<Milestone | null>(null);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [editingIssue, setEditingIssue] = useState<Issue | null>(null);
  const [showRawData, setShowRawData] = useState(false);
  const [issueSearch, setIssueSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [priorityFilter, setPriorityFilter] = useState<string | null>(null);
  const [extraIssues, setExtraIssues] = useState<any[]>([]);
  const [issuesCursor, setIssuesCursor] = useState<string | null>(null);
  const [hasMoreIssues, setHasMoreIssues] = useState(false);
  const [loadingMoreIssues, setLoadingMoreIssues] = useState(false);

  const INITIAL_YEAR = new Date().getFullYear();
  const [year, setYear] = useState(INITIAL_YEAR);

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

  // Ascending by project start date — projects with no known start date sort last.
  const sortedProjectEntries = useMemo(() => {
    return Object.entries(groupedMilestones).sort(([nameA], [nameB]) => {
      const dateA = projectStartDates[nameA];
      const dateB = projectStartDates[nameB];
      if (!dateA && !dateB) return 0;
      if (!dateA) return 1;
      if (!dateB) return -1;
      return new Date(dateA).getTime() - new Date(dateB).getTime();
    });
  }, [groupedMilestones, projectStartDates]);

  function handleMilestoneSelect(m: Milestone) {
    setSelectedMilestone((prev) =>
      prev?.name === m.name && prev?.projectName === m.projectName ? null : m,
    );
  }

  const selectedKey = selectedMilestone
    ? selectedMilestone.name + selectedMilestone.projectName
    : undefined;

  // Filters and pagination are scoped to whichever milestone is open —
  // switching milestones shouldn't carry over a stale filter or the extra
  // issues loaded for a different milestone.
  useEffect(() => {
    setIssueSearch("");
    setStatusFilter(null);
    setPriorityFilter(null);
    setExtraIssues([]);
    setIssuesCursor(selectedMilestone?.issues.pageInfo?.endCursor ?? null);
    setHasMoreIssues(selectedMilestone?.issues.pageInfo?.hasNextPage ?? false);
  }, [selectedKey]);

  async function handleLoadMoreIssues() {
    if (!selectedMilestone || loadingMoreIssues) return;
    setLoadingMoreIssues(true);
    try {
      const params = new URLSearchParams({ milestoneId: selectedMilestone.id });
      if (issuesCursor) params.set("after", issuesCursor);
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/roadmap?${params.toString()}`,
        { headers: API_JSON_HEADERS },
      );
      if (!res.ok) throw new Error("Failed to load more issues");
      const data = await res.json();
      setExtraIssues((prev) => [...prev, ...(data.nodes ?? [])]);
      setHasMoreIssues(data.pageInfo?.hasNextPage ?? false);
      setIssuesCursor(data.pageInfo?.endCursor ?? null);
    } catch (err) {
      console.error("Failed to load more milestone issues:", err);
    } finally {
      setLoadingMoreIssues(false);
    }
  }

  const milestoneIssues: any[] = [...(selectedMilestone?.issues.nodes ?? []), ...extraIssues];

  const availableStatuses = useMemo(
    () => Array.from(new Set(milestoneIssues.map((i) => i.state?.name).filter(Boolean))),
    [milestoneIssues],
  );
  const availablePriorities = useMemo(
    () => Array.from(new Set(milestoneIssues.map((i) => i.priorityLabel).filter(Boolean))),
    [milestoneIssues],
  );

  const visibleIssues = milestoneIssues.filter((issue) => {
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
      <Card className="overflow-hidden bg-background">
        <TimelineHeader
          year={year}
          onPrev={() => setYear((y) => y - 1)}
          onNext={() => setYear((y) => y + 1)}
          onViewRawData={() => {
            console.log(
              "Roadmap raw data:",
              rawData ?? { projectMilestones, allProjectNames, projectStartDates },
            );
            setShowRawData(true);
          }}
        />

        <CardContent className="overflow-x-auto px-2 sm:px-6">
          <div className="min-w-0 sm:min-w-[560px]">
            
            <TimelineMonthsHeader year={year} />
            {sortedProjectEntries.map(
              ([projectName, milestones]) => (
                <ProjectRow
                  key={projectName}
                  projectName={projectName}
                  milestones={milestones}
                  projectStartDate={projectStartDates[projectName] ?? null}
                  year={year}
                  expanded={!!expandedProjects[projectName]}
                  onToggle={() =>
                    setExpandedProjects((p) => ({
                      ...p,
                      [projectName]: !p[projectName],
                    }))
                  }
                  onMilestoneSelect={handleMilestoneSelect}
                  selectedMilestoneId={selectedKey}
                />
              ),
            )}
          </div>
        </CardContent>
      </Card>

      {selectedMilestone && (
        <Card className="bg-background ">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold">
                  {selectedMilestone.name}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {selectedMilestone.projectName}
                </p>
              </div>
              <button
                onClick={() => setSelectedMilestone(null)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {milestoneIssues.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No issues in this milestone.
              </p>
            ) : (
              <>
                <div className="flex flex-col gap-2 mb-4 sm:flex-row sm:items-center sm:flex-wrap">
                  <div className="relative flex-1 sm:max-w-[220px]">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Search by title or ID..."
                      value={issueSearch}
                      onChange={(e) => setIssueSearch(e.target.value)}
                      className="w-full rounded-md border border-border bg-background pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
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
                          className={`text-[11px] px-2.5 py-1 rounded-md border font-medium transition-all ${
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
                          className={`text-[11px] px-2.5 py-1 rounded-md border font-medium transition-all ${
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
                  <p className="text-sm text-muted-foreground">
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
                    className="group relative rounded-md border bg-background p-3 space-y-2 hover:bg-secondary/40 transition-colors"
                  >
                    <button
                      type="button"
                      className="absolute inset-0 rounded-md cursor-pointer"
                      onClick={() => setSelectedIssue(toIssue(issue))}
                      aria-label={issue.title ?? "View issue"}
                    />
                    <button
                      type="button"
                      className="absolute top-2 right-2 z-10 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
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
                            <p className="flex items-center gap-1 text-[10px] text-muted-foreground font-mono">
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
                                  className={`text-[10px] ${priorityColors[issue.priorityLabel] ?? ""}`}
                                >
                                  {issue.priorityLabel}
                                </Badge>
                              )}
                          </div>
                        )}
                        {issue.title && (
                          <p className="text-xs font-medium leading-snug">{issue.title}</p>
                        )}
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {issue.estimate != null && (
                        <Badge
                          variant="outline"
                          className="gap-1 text-[10px] border-chart-1/30 bg-chart-1/10 text-chart-1"
                        >
                          <Gauge className="h-3 w-3" />
                          {issue.estimate}
                        </Badge>
                      )}
                      {issue.state?.name && (
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${stateColors[issue.state.name] ?? "bg-muted border-border text-muted-foreground"}`}
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
                            className="text-[10px] bg-muted rounded px-1.5 py-0.5 text-muted-foreground"
                          >
                            {l.name}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="space-y-0.5">
                      {issue.assignee?.displayName && (
                        <p className="text-xs text-muted-foreground">
                          Assignee:{" "}
                          <span className="text-foreground">
                            {issue.assignee.displayName}
                          </span>
                        </p>
                      )}
                      {issue.dueDate && (
                        <p className="text-xs text-muted-foreground">
                          Due:{" "}
                          <span className="text-foreground">
                            {new Date(issue.dueDate).toLocaleDateString()}
                          </span>
                        </p>
                      )}
                      {issue.completedAt && (
                        <p className="text-xs text-muted-foreground">
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

                {hasMoreIssues && (
                  <div className="flex justify-center mt-3">
                    <button
                      type="button"
                      onClick={handleLoadMoreIssues}
                      disabled={loadingMoreIssues}
                      className="text-xs px-3 py-1.5 rounded-md border border-border bg-muted/40 text-muted-foreground hover:bg-muted disabled:opacity-50"
                    >
                      {loadingMoreIssues ? "Loading..." : "Load more issues"}
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

      <Dialog open={showRawData} onOpenChange={setShowRawData}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Raw Roadmap Data</DialogTitle>
          </DialogHeader>
          <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-md bg-secondary/30 p-4 text-xs">
            {JSON.stringify(
              rawData ?? { projectMilestones, allProjectNames, projectStartDates },
              null,
              2,
            )}
          </pre>
        </DialogContent>
      </Dialog>
    </div>
  );
}
