"use client";

import { IssueSkeletons } from "./issue-skeletons";
import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AlertTriangle, ArrowRight, ArrowUpDown, Columns3, LayoutGrid, List, Search, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUser } from "context/UserContext";
import { getIssueCode } from "@/lib/utils";
import { type Issue, type IssueViewMode, type PriorityTasksProps, statusColors, isClosedIssue } from "./issues.types";
import { IssueDetailModal } from "./issue-detail-modal";
import { IssueCard, IssueListRow } from "./issue-cards";
import { useIssueUpdateBadge } from "./use-issue-update-badge";
import { TaskFilterPanel, ActiveFilterChips } from "./task-filter-panel";

function canEditIssue(issue: Issue) {
  return !isClosedIssue(issue);
}

// Board columns in the order a ticket moves through them; these always show
// (even empty). Any other open status a ticket is in gets its own column after.
const BOARD_COLUMNS = ["Backlog", "Planning", "Development", "QA", "UAT"];
// Finished or dropped work isn't part of the board.
const BOARD_HIDDEN_STATUSES = new Set(["Done", "Approved", "Canceled"]);

const VIEW_OPTIONS: { value: IssueViewMode; label: string; Icon: typeof List }[] = [
  { value: "grid", label: "Grid", Icon: LayoutGrid },
  { value: "board", label: "Board", Icon: Columns3 },
  { value: "list", label: "List", Icon: List },
];

function ViewSwitcher({ value, onChange }: { readonly value: IssueViewMode; readonly onChange: (v: IssueViewMode) => void }) {
  return (
    <div className="flex items-center rounded-md border border-input p-0.5" role="group" aria-label="View">
      {VIEW_OPTIONS.map(({ value: v, label, Icon }) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          aria-pressed={value === v}
          aria-label={`${label} view`}
          title={`${label} view`}
          className={`flex h-6 w-7 items-center justify-center rounded transition-colors ${
            value === v ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Icon className="h-3.5 w-3.5" />
        </button>
      ))}
    </div>
  );
}

export type { Decision, Test, TestExecution, Issue, FilterState, PriorityTasksProps } from "./issues.types";
export { STATUS_ORDER } from "./issues.types";
export { IssueDetailModal } from "./issue-detail-modal";

// Groups tickets into board columns. With a status filter on, only the
// filtered statuses get a column.
function boardColumns(issues: Issue[], selectedStatuses: string[]) {
  const byStatus = new Map<string, Issue[]>();
  issues.forEach((i) => {
    const status = i.state?.name ?? "No status";
    if (BOARD_HIDDEN_STATUSES.has(status)) return;
    byStatus.set(status, [...(byStatus.get(status) ?? []), i]);
  });
  const extra = [...byStatus.keys()].filter((s) => !BOARD_COLUMNS.includes(s));
  const statuses = [...BOARD_COLUMNS, ...extra].filter(
    (s) => (selectedStatuses.length === 0 ? true : selectedStatuses.includes(s)),
  );
  return statuses.map((status) => ({ status, issues: byStatus.get(status) ?? [] }));
}

// What every ticket card/row needs from the page.
type IssueItemProps = {
  readonly onOpen: (issue: Issue) => void;
  readonly hasUpdate: (issue: Issue) => boolean;
  readonly lightCard: boolean;
  readonly showProject: boolean;
};

const SCROLL_LIMIT = "max-h-[600px] overflow-y-auto";

function IssueRows({ issues, className, ...item }: IssueItemProps & { readonly issues: Issue[]; readonly className: string }) {
  return (
    <div className={className}>
      {issues.map((issue) => (
        <IssueListRow
          key={issue.id}
          issue={issue}
          onOpen={() => item.onOpen(issue)}
          hasUpdate={item.hasUpdate(issue)}
          lightCard={item.lightCard}
          showProject={item.showProject}
        />
      ))}
    </div>
  );
}

// The small card's body: skeletons, "No issues." or the rows.
function CompactIssues({ loading, issues, ...item }: IssueItemProps & { readonly loading: boolean; readonly issues: Issue[] }) {
  if (loading) {
    return <IssueSkeletons view="list" count={4} />;
  }
  if (issues.length === 0) {
    return <p className="smalltext text-muted-foreground italic px-1">No issues.</p>;
  }
  return (
    <IssueRows issues={issues} className="flex flex-col gap-0.5 flex-1 min-h-0 overflow-y-auto custom-scrollbar" {...item} />
  );
}

function BoardView({
  issues,
  selectedStatuses,
  expanded,
  ...item
}: IssueItemProps & { readonly issues: Issue[]; readonly selectedStatuses: string[]; readonly expanded: boolean }) {
  return (
    <div className="flex gap-3 overflow-x-auto pt-3 pb-2 custom-scrollbar">
      {boardColumns(issues, selectedStatuses).map(({ status, issues: columnIssues }) => (
        <section
          key={status}
          aria-label={`${status}, ${columnIssues.length} ticket${columnIssues.length === 1 ? "" : "s"}`}
          className="flex w-72 shrink-0 flex-col rounded-lg bg-muted/30 p-2"
        >
          <header className="flex items-center justify-between px-1 pb-2">
            <span
              className={`smalltext rounded px-2 py-0.5 font-medium ${
                statusColors[status as keyof typeof statusColors] ?? "bg-muted text-muted-foreground"
              }`}
            >
              {status}
            </span>
            <span className="smalltext tabular-nums text-muted-foreground">{columnIssues.length}</span>
          </header>
          <div className={`flex flex-col gap-2 custom-scrollbar ${expanded ? "" : SCROLL_LIMIT}`}>
            {columnIssues.length === 0 && <p className="smalltext text-muted-foreground italic px-1 py-3">No tickets</p>}
            {columnIssues.map((issue) => (
              <IssueCard
                key={issue.id}
                issue={issue}
                onOpen={() => item.onOpen(issue)}
                hasUpdate={item.hasUpdate(issue)}
                lightCard={item.lightCard}
                showProject={item.showProject}
                statusAndCycleOnly
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function GridView({
  issues,
  expanded,
  scrollRef,
  ...item
}: IssueItemProps & {
  readonly issues: Issue[];
  readonly expanded: boolean;
  readonly scrollRef: React.RefObject<HTMLDivElement>;
}) {
  return (
    <div
      ref={scrollRef}
      className={`
        grid gap-2 grid-flow-row auto-rows-auto pt-3
        grid-cols-[repeat(auto-fit,minmax(280px,1fr))]
        custom-scrollbar
        overflow-x-hidden
        ${expanded ? "overflow-y-visible h-auto" : SCROLL_LIMIT}
      `}
    >
      {issues.map((issue) => (
        <IssueCard
          key={issue.id}
          issue={issue}
          onOpen={() => item.onOpen(issue)}
          hasUpdate={item.hasUpdate(issue)}
          lightCard={item.lightCard}
          showProject={item.showProject}
        />
      ))}
    </div>
  );
}

// The full card's body: skeletons, the empty state, or the tickets in the
// chosen view (board, list or grid).
function IssueViews({
  loading,
  issues,
  viewMode,
  emptyState,
  selectedStatuses,
  expanded,
  scrollRef,
  ...item
}: IssueItemProps & {
  readonly loading: boolean;
  readonly issues: Issue[];
  readonly viewMode: IssueViewMode;
  readonly emptyState: React.ReactNode;
  readonly selectedStatuses: string[];
  readonly expanded: boolean;
  readonly scrollRef: React.RefObject<HTMLDivElement>;
}) {
  if (loading) {
    return <IssueSkeletons view={viewMode} />;
  }
  if (issues.length === 0) {
    return emptyState ?? <p className="smalltext text-muted-foreground italic p-2">No issues match the current filters.</p>;
  }
  if (viewMode === "board") {
    return <BoardView issues={issues} selectedStatuses={selectedStatuses} expanded={expanded} {...item} />;
  }
  if (viewMode === "list") {
    return (
      <IssueRows
        issues={issues}
        className={`flex flex-col gap-0.5 pt-3 custom-scrollbar ${expanded ? "" : SCROLL_LIMIT}`}
        {...item}
      />
    );
  }
  return <GridView issues={issues} expanded={expanded} scrollRef={scrollRef} {...item} />;
}

export function PriorityTasks({
  issuesData,
  filterState,
  onEditIssue,
  title = "Priority Tasks",
  compact = false,
  lightCard = false,
  showProject = false,
  headerAction,
  slug,
  sortBy,
  onSortByChange,
  initialModalTab,
  openIssueId,
  openIssueTab,
  onDeepLinkClose,
  viewMode = "grid",
  onViewModeChange,
  emptyState,
  loading = false,
}: PriorityTasksProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [titleFilter, setTitleFilter] = useState("");
  const { profile } = useUser();
  const { hasUnseenUpdate } = useIssueUpdateBadge();

  // Deep link from a notification — open once the target issue actually
  // shows up in issuesData (it may not be there on the very first render if
  // the fetch is still in flight).
  useEffect(() => {
    if (!openIssueId) return;
    const match = issuesData.find((i) => i.id === openIssueId);
    if (match) setSelectedIssue(match);
  }, [openIssueId, issuesData]);

  const {
    selectedStatuses,
    onlyActive,
    selectedCycles = [],
    selectedPriorities = [],
    dateFrom = "",
    dateTo = "",
  } = filterState;

  const activeFilters =
    selectedStatuses.length +
    selectedCycles.length +
    selectedPriorities.length +
    (dateFrom ? 1 : 0) +
    (dateTo ? 1 : 0) +
    (onlyActive ? 1 : 0);

  const visibleIssues = titleFilter.trim()
    ? issuesData.filter((i) => {
        const query = titleFilter.toLowerCase();
        return (
          i.title.toLowerCase().includes(query) ||
          getIssueCode(i.branchName).toLowerCase().includes(query)
        );
      })
    : issuesData;

  const itemProps: IssueItemProps = {
    onOpen: setSelectedIssue,
    hasUpdate: (issue) => hasUnseenUpdate(issue, profile?.email),
    lightCard,
    showProject,
  };

  // Pages spanning multiple customers (the developer dashboard) don't pass a
  // fixed `slug` — fall back to the selected issue's own `_project` tag.
  const modal = selectedIssue && (
    <IssueDetailModal
      issue={selectedIssue}
      slug={slug ?? (selectedIssue as any)._project}
      onClose={() => {
        if (selectedIssue.id === openIssueId) onDeepLinkClose?.();
        setSelectedIssue(null);
      }}
      onEdit={
        onEditIssue && canEditIssue(selectedIssue)
          ? () => onEditIssue(selectedIssue)
          : undefined
      }
      initialTab={selectedIssue.id === openIssueId ? (openIssueTab ?? initialModalTab) : initialModalTab}
    />
  );
  if (compact) {
    return (
      <Card className="bg-background border-transparent sm:border-border rounded-none sm:rounded-xl text-foreground flex flex-col w-full h-full ">
        <CardHeader className="flex flex-row items-center justify-between flex-shrink-0 pt-[14px] pb-3 pr-10">
          <CardTitle className="body font-semibold flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-warning" />
            {title}
          </CardTitle>
          <div className="flex items-center gap-2">
            {headerAction}
            {issuesData.length > 0 && (
              <span className="smalltext text-muted-foreground tabular-nums">
                {issuesData.length} issue{issuesData.length === 1 ? "" : "s"}
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col overflow-hidden px-2 pb-3">
          <CompactIssues loading={loading} issues={visibleIssues} {...itemProps} />
        </CardContent>
        {modal}
      </Card>
    );
  }

  return (
    <Card className="bg-background border-transparent sm:border-border rounded-none sm:rounded-xl text-foreground flex flex-col w-full h-full">
      <CardHeader className="flex flex-col gap-2 flex-shrink-0 pt-[14px] pb-3">
        <CardTitle className="body font-semibold flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-warning" />
          {title}
        </CardTitle>
        <div className="flex items-center gap-2 flex-wrap">
          {headerAction}
          {sortBy && onSortByChange && (
            <Select
              value={sortBy}
              onValueChange={(v) => onSortByChange(v as "updated" | "priority")}
            >
              <SelectTrigger
                className="h-7 w-[130px] shrink-0 gap-1.5 rounded-md border border-input bg-background px-3 smalltext font-medium shadow-none ring-offset-background hover:bg-accent hover:text-accent-foreground focus:ring-1 focus:ring-ring [&>span]:truncate"
                onClick={(e) => e.stopPropagation()}
              >
                <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                <SelectItem value="updated" className="smalltext">
                  Last Updated
                </SelectItem>
                <SelectItem value="priority" className="smalltext">
                  Priority
                </SelectItem>
              </SelectContent>
            </Select>
          )}
          <Popover open={filterOpen} onOpenChange={setFilterOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-7 smalltext gap-1.5 relative"
                onClick={(e) => e.stopPropagation()}
              >
                <SlidersHorizontal className="h-3 w-3" />
                Filter
                {activeFilters > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center">
                    {activeFilters}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className="w-96 p-4 bg-background border-border text-foreground"
              onClick={(e) => e.stopPropagation()}
            >
              <TaskFilterPanel filterState={filterState} activeFilters={activeFilters} />
            </PopoverContent>
          </Popover>
          {onViewModeChange && <ViewSwitcher value={viewMode} onChange={onViewModeChange} />}
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
          {/* Search sits on its own at the right; everything else stays left. */}
          <div className="relative flex-1 min-w-[120px] sm:flex-none sm:w-52 sm:ml-auto">
            <Search className="absolute left-2.5 top-1/2 z-10 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              type="text"
              aria-label="Search by title or issue code"
              placeholder="Search by title or code..."
              value={titleFilter}
              onChange={(e) => setTitleFilter(e.target.value)}
              className="h-7 pl-8 bg-secondary/30 border-border smalltext"
            />
          </div>
        </div>
      </CardHeader>
      {activeFilters > 0 && (
        <div className="px-6 pb-3 -mt-1 flex-shrink-0">
          <ActiveFilterChips filterState={filterState} />
        </div>
      )}
      <CardContent className="flex-1 overflow-hidden overflow-x-hidden">
        <IssueViews
          loading={loading}
          issues={visibleIssues}
          viewMode={viewMode}
          emptyState={emptyState}
          selectedStatuses={selectedStatuses}
          expanded={expanded}
          scrollRef={scrollRef}
          {...itemProps}
        />
      </CardContent>
      {modal}
    </Card>
  );
}
