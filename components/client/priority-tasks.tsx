"use client";

import { useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, ArrowRight, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/components/ui/button";
import { useUser } from "context/UserContext";
import { type Issue, type PriorityTasksProps } from "./issues.types";
import { IssueDetailModal } from "./issue-detail-modal";
import { IssueCard, IssueListRow } from "./issue-cards";
import { useIssueUpdateBadge } from "./use-issue-update-badge";
import { TaskFilterPanel } from "./task-filter-panel";

function canEditIssue(issue: Issue) {
  return issue.state?.name !== "Done";
}

export type { Decision, TestCase, Issue, FilterState, PriorityTasksProps } from "./issues.types";
export { STATUS_ORDER } from "./issues.types";
export { IssueDetailModal } from "./issue-detail-modal";

export function PriorityTasks({
  issuesData,
  filterState,
  onEditIssue,
  title = "Priority Tasks",
  compact = false,
  headerAction,
}: PriorityTasksProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [titleFilter, setTitleFilter] = useState("");
  const { profile } = useUser();
  const { hasUnseenUpdate } = useIssueUpdateBadge();

  const {
    selectedStatuses,
    onlyActive,
    selectedLabels = [],
    selectedPriorities = [],
    dateFrom = "",
    dateTo = "",
  } = filterState;

  const activeFilters =
    selectedStatuses.length +
    selectedLabels.length +
    selectedPriorities.length +
    (dateFrom ? 1 : 0) +
    (dateTo ? 1 : 0) +
    (onlyActive ? 1 : 0);

  const visibleIssues = titleFilter.trim()
    ? issuesData.filter((i) =>
        i.title.toLowerCase().includes(titleFilter.toLowerCase()),
      )
    : issuesData;

  const modal = selectedIssue && (
    <IssueDetailModal
      issue={selectedIssue}
      onClose={() => setSelectedIssue(null)}
    />
  );
  if (compact) {
    return (
      <Card className="bg-background border-border flex flex-col w-full h-full ">
        <CardHeader className="flex flex-row items-center justify-between flex-shrink-0 pt-[14px] pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-warning" />
            {title}
          </CardTitle>
          <div className="flex items-center gap-2">
            {headerAction}
            {issuesData.length > 0 && (
              <span className="text-xs text-muted-foreground tabular-nums">
                {issuesData.length} issue{issuesData.length === 1 ? "" : "s"}
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col overflow-hidden px-2 pb-3">
          {visibleIssues.length === 0 ? (
            <p className="text-sm text-muted-foreground italic px-1">No issues.</p>
          ) : (
            <div className="flex flex-col gap-0.5 flex-1 min-h-0 overflow-y-auto scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
              {visibleIssues.map((issue) => (
                <IssueListRow
                  key={issue.id}
                  issue={issue}
                  onOpen={() => setSelectedIssue(issue)}
                  onEdit={
                    onEditIssue && canEditIssue(issue)
                      ? () => onEditIssue(issue)
                      : undefined
                  }
                  hasUpdate={hasUnseenUpdate(issue, profile?.email)}
                />
              ))}
            </div>
          )}
        </CardContent>
        {modal}
      </Card>
    );
  }

  return (
    <Card className="bg-background border-border flex flex-col w-full">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 flex-shrink-0 pt-[14px] pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-warning" />
          {title}
        </CardTitle>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="text"
            placeholder="Search by title..."
            value={titleFilter}
            onChange={(e) => setTitleFilter(e.target.value)}
            className="h-7 flex-1 min-w-[120px] sm:flex-none sm:w-36 rounded-md border border-border bg-secondary/30 px-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1.5 relative"
              onClick={(e) => {
                e.stopPropagation();
                setFilterOpen((v) => !v);
              }}
            >
              <SlidersHorizontal className="h-3 w-3" />
              Filter
              {activeFilters > 0 && (
                <span className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-accent text-accent-foreground text-[10px] flex items-center justify-center">
                  {activeFilters}
                </span>
              )}
            </Button>
            {filterOpen && (
              <TaskFilterPanel filterState={filterState} activeFilters={activeFilters} />
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? "Collapse" : "View all"}
            <ArrowRight
              className={`ml-1 h-3 w-3 transition-transform ${expanded ? "rotate-90" : ""}`}
            />
          </Button>
        </div>
      </CardHeader>
      <CardContent
        className="flex-1 overflow-hidden"
        onClick={() => filterOpen && setFilterOpen(false)}
      >
        {visibleIssues.length === 0 ? (
          <p className="text-sm text-muted-foreground italic p-2">
            No issues match the current filters.
          </p>
        ) : (
          <div
            ref={scrollRef}
            className={`
              grid gap-2 px-3 py-2 grid-flow-row auto-rows-auto
              grid-cols-[repeat(auto-fill,minmax(280px,1fr))]
              scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent
              ${
                expanded
                  ? "overflow-visible h-auto"
                  : "max-h-[600px] overflow-y-auto"
              }
            `}
          >
            {visibleIssues.map((issue) => (
              <IssueCard
                key={issue.id}
                issue={issue}
                onOpen={() => setSelectedIssue(issue)}
                onEdit={
                  onEditIssue && canEditIssue(issue)
                    ? () => onEditIssue(issue)
                    : undefined
                }
                hasUpdate={hasUnseenUpdate(issue, profile?.email)}
              />
            ))}
          </div>
        )}
      </CardContent>
      {modal}
    </Card>
  );
}
