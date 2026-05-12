"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  ArrowRight,
  Send,
  ChevronsRight,
  Filter,
  MessageSquare,
  X,
} from "lucide-react";
import { Button } from "@/components/components/ui/button";
import { useEffect, useRef, useState } from "react";
import { useUser } from "context/UserContext";

const priorityColors = {
  Urgent: "bg-destructive/20 text-destructive border-destructive/30",
  High: "bg-warning/20 text-warning border-warning/30",
  Medium: "bg-accent/20 text-accent border-accent/30",
  Low: "bg-muted/50 text-muted-foreground border-muted",
};

const statusColors = {
  "needs-input": "bg-chart-1/20 text-chart-1",
  Backlog: "bg-muted/50 text-muted-foreground",
  Todo: "bg-slate-500/20 text-slate-600",
  "In Progress": "bg-warning/20 text-warning",
  "In Review": "bg-blue-500/20 text-blue-600",
  Blocked: "bg-destructive/20 text-destructive",
  "Not Started": "bg-muted/50 text-muted-foreground",
  Canceled: "bg-destructive/20 text-destructive",
  waiting: "bg-muted text-muted-foreground",
  Done: "bg-success/20 text-success",
  Completed: "bg-success/20 text-success",
  QA: "bg-blue-700/20 text-blue-700",
  "Business Review": "bg-orange-500/20 text-orange-600",
  Development: "bg-orange-500/20 text-orange-600",
  UAT: "bg-teal-500/20 text-teal-600",
  Planning: "bg-yellow-500/20 text-yellow-600",
};

export type Comment = {
  id: string;
  body: string;
  createdAt?: string;
  displayName?: string | null;
};

export type Issue = {
  id: string;
  branchName: string;
  priorityLabel: "Urgent" | "High" | "Medium" | "Low";
  title: string;
  state?: {
    name:
      | "needs-input"
      | "Backlog"
      | "Todo"
      | "In Progress"
      | "In Review"
      | "Blocked"
      | "Not Started"
      | "Canceled"
      | "waiting"
      | "Done"
      | "Completed"
      | "QA"
      | "Business Review"
      | "Development"
      | "UAT"
      | "Planning";
  };
  cycle?: { number: number; isActive: boolean; name?: string };
  comments?: { nodes: Comment[] };
  description?: string | null;
};

export type FilterState = {
  selectedStatuses: string[];
  onlyActive: boolean;
  availableStatuses: string[];
  hasCycles: boolean;
  onToggleStatus: (s: string) => void;
  onToggleActive: () => void;
  onClearFilters: () => void;
};

export type PriorityTasksProps = {
  issuesData: Issue[];
  filterState: FilterState;
  onOpenChat?: (title: string) => void;
  title?: string;
  questionCounts?: Record<string, number>;
  compact?: boolean;
};

const STATE_TRANSITIONS: Partial<Record<string, string>> = {
  "Business Review": "UAT",
  UAT: "Done",
};

function IssueCard({
  issue,
  onOpen,
  onOpenChat,
  questionCount = 0,
}: {
  readonly issue: Issue;
  readonly onOpen: () => void;
  readonly onOpenChat?: (title: string) => void;
  readonly questionCount?: number;
}) {
  const chatTitle = `${issue.branchName.slice(0, 7).toUpperCase()} ${issue.title}`;
  return (
    <div
      className="flex-shrink-0 w-[280px] rounded-lg border border-border bg-secondary/30 hover:bg-secondary/60 hover:scale-[1.02] hover:shadow-md transition-all duration-150 cursor-pointer"
      onClick={onOpen}
    >
      <div className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-mono text-muted-foreground">
            {issue.branchName.slice(0, 7).toUpperCase()}
          </span>
          <Badge
            variant="outline"
            className={
              priorityColors[issue.priorityLabel as keyof typeof priorityColors]
            }
          >
            {issue.priorityLabel}
          </Badge>
          {questionCount > 0 && (
            <span className="ml-auto flex items-center gap-1 rounded-full bg-warning/20 text-warning border border-warning/30 text-[10px] font-semibold px-1.5 py-0.5">
              {questionCount}
            </span>
          )}
        </div>
        <p className="text-sm font-medium text-background-foreground mb-1 line-clamp-2">
          {issue.title}
        </p>
        {issue.description && (
          <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
            {issue.description}
          </p>
        )}
        {!issue.description && <div className="mb-3" />}
        <div className="flex items-center justify-between">
          <Badge
            variant="secondary"
            className={
              statusColors[issue?.state?.name as keyof typeof statusColors]
            }
          >
            {issue?.state?.name}
          </Badge>
          {onOpenChat && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenChat(chatTitle);
              }}
              className="text-muted-foreground hover:text-accent transition-colors"
              title="Open chat about this issue"
            >
              <MessageSquare className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function IssueListRow({
  issue,
  onOpen,
  questionCount = 0,
}: {
  readonly issue: Issue;
  readonly onOpen: () => void;
  readonly questionCount?: number;
}) {
  return (
    <div
      className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-secondary/60 cursor-pointer transition-all border border-transparent hover:border-border group"
      onClick={onOpen}
    >
      <span className="text-[10px] font-mono text-muted-foreground w-14 flex-shrink-0">
        {issue.branchName.slice(0, 7).toUpperCase()}
      </span>
      <Badge
        variant="outline"
        className={`text-[10px] flex-shrink-0 ${priorityColors[issue.priorityLabel as keyof typeof priorityColors]}`}
      >
        {issue.priorityLabel}
      </Badge>
      <p className="text-xs font-medium flex-1 truncate">{issue.title}</p>
      {questionCount > 0 && (
        <span className="flex-shrink-0 rounded-full bg-warning/20 text-warning border border-warning/30 text-[10px] font-semibold px-1.5 py-0.5">
          {questionCount}
        </span>
      )}
    </div>
  );
}

function IssueDetailModal({
  issue,
  onClose,
  questionCount = 0,
  onMarkedRead,
}: {
  issue: Issue;
  onClose: () => void;
  questionCount?: number;
  onMarkedRead?: () => void;
}) {
  const { profile } = useUser();
  const [visible, setVisible] = useState(false);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [currentStateName, setCurrentStateName] = useState(issue.state?.name);
  const [showDescription, setShowDescription] = useState(true);
  const [showComments, setShowComments] = useState(false);
  const [localComments, setLocalComments] = useState<Comment[]>(issue.comments?.nodes ?? []);

  const nextState = currentStateName
    ? STATE_TRANSITIONS[currentStateName]
    : undefined;

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    if (questionCount > 0 && profile?.id) {
      fetch(`${process.env.NEXT_PUBLIC_ENDPOINT}/issue-questions/read`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_APIKEY}`,
          apikey: process.env.NEXT_PUBLIC_APIKEY!,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ issue_id: issue.id, user_id: profile.id }),
      }).then(() => onMarkedRead?.());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 180);
  };

  async function handleAdvanceState() {
    if (!nextState || advancing) return;
    setAdvancing(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_ENDPOINT}/issues`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_APIKEY}`,
          apikey: process.env.NEXT_PUBLIC_APIKEY!,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ issueId: issue.id, stateName: nextState }),
      });
      const data = await res.json();
      if (data.success) {
        setCurrentStateName(nextState as NonNullable<Issue["state"]>["name"]);
      }
    } finally {
      setAdvancing(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!comment.trim() || submitting) return;
    setSubmitting(true);
    try {
      await fetch(`${process.env.NEXT_PUBLIC_ENDPOINT}/issue-questions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_APIKEY}`,
          apikey: process.env.NEXT_PUBLIC_APIKEY!,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          issue_id: issue.id,
          body: `From: ${profile?.email}\n\n${comment.trim()}`,
          role: profile?.role,
          profile_id: profile?.id,
          email: profile?.email,
        }),
      });
      setLocalComments((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          body: `From: ${profile?.email}\n\n${comment.trim()}`,
          createdAt: new Date().toISOString(),
          displayName: null,
        },
      ]);
      setComment("");
    } finally {
      setSubmitting(false);
    }
  }


  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center transition-all duration-200 ${
        visible
          ? "bg-black/60 backdrop-blur-sm"
          : "bg-transparent backdrop-blur-none"
      }`}
      onClick={handleClose}
    >
      <div
        className={`relative bg-background border border-border rounded-2xl shadow-2xl w-full max-w-lg mx-4 flex flex-col max-h-[85vh] transition-all duration-200 ${
          visible
            ? "opacity-100 scale-100 translate-y-0"
            : "opacity-0 scale-95 translate-y-2"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 p-5 border-b border-border">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="text-xs font-mono text-muted-foreground">
                {issue.branchName.slice(0, 7).toUpperCase()}
              </span>
              <Badge
                variant="outline"
                className={
                  priorityColors[
                    issue.priorityLabel as keyof typeof priorityColors
                  ]
                }
              >
                {issue.priorityLabel}
              </Badge>
              <Badge
                variant="secondary"
                className={
                  statusColors[currentStateName as keyof typeof statusColors]
                }
              >
                {currentStateName}
              </Badge>
            </div>
            <h2 className="text-base font-semibold leading-snug">
              {issue.title}
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0 mt-0.5"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Advance state */}
          {nextState && (
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              disabled={advancing}
              onClick={handleAdvanceState}
            >
              <ChevronsRight className="h-3 w-3 mr-1" />
              {advancing ? "Updating…" : `Move to ${nextState}`}
            </Button>
          )}

          {/* Description */}
          {issue.description && (
            <div className="space-y-1">
              <button
                onClick={() => setShowDescription((v) => !v)}
                className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
              >
                Description
                <ArrowRight
                  className={`h-3 w-3 transition-transform ${showDescription ? "rotate-90" : ""}`}
                />
              </button>
              {showDescription && (
                <p className="text-sm text-foreground whitespace-pre-wrap rounded-lg bg-muted/40 p-3">
                  {issue.description}
                </p>
              )}
            </div>
          )}
          <div onClick={() => console.log({localComments})}>VER localComments</div>

          {/* Comments */}
          <div className="space-y-2">
            <button
              onClick={() => setShowComments((v) => !v)}
              className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
            >
              Comments {localComments.length > 0 && `(${localComments.length})`}
              <ArrowRight
                className={`h-3 w-3 transition-transform ${showComments ? "rotate-90" : ""}`}
              />
            </button>

            {showComments && localComments.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">
                No localComments yet.
              </p>
            ) : showComments ? (
              <div className="space-y-2">
                {localComments.map((c) => {
                  const fromFmt = c.body
                    ? /^From:\s+(\S+)(?:\n\n|\s+)([\s\S]*)$/.exec(c.body)
                    : null;
                  const author = fromFmt?.[1] ?? null;
                  const text = fromFmt?.[2] ?? c.body ?? "";
                  return (
                    <div
                      key={c.id}
                      className="rounded-lg bg-muted/40 p-3 space-y-1"
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        {author ? (
                          <Badge
                            variant="secondary"
                            className="text-[10px] font-medium"
                          >
                            {author}
                          </Badge>
                        ) : c.displayName ? (
                          <span className="text-[10px] font-medium text-muted-foreground">
                            {c.displayName}
                          </span>
                        ) : null}
                        {c.createdAt && (
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(c.createdAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-foreground whitespace-pre-wrap">
                        {text}
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>

        {/* Footer — comment input */}
        <div className="border-t border-border p-4">
          <form onSubmit={handleSubmit} className="flex flex-col gap-2">
            <textarea
              className="w-full rounded-lg border border-border bg-secondary/30 text-sm text-foreground placeholder:text-muted-foreground p-2.5 resize-none focus:outline-none focus:ring-1 focus:ring-ring"
              rows={3}
              placeholder="Add a comment... "
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey))
                  handleSubmit(e as any);
              }}
            />
            <Button
              type="submit"
              size="sm"
              className="self-end"
              disabled={!comment.trim() || submitting}
            >
              <Send className="h-3 w-3 mr-1" />
              {submitting ? "Sending…" : "Send"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

export function PriorityTasks({
  issuesData,
  filterState,
  onOpenChat,
  title = "Priority Tasks",
  questionCounts = {},
  compact = false,
}: PriorityTasksProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [titleFilter, setTitleFilter] = useState("");
  const [locallyRead, setLocallyRead] = useState<Set<string>>(new Set());

  const {
    selectedStatuses,
    onlyActive,
    availableStatuses,
    hasCycles,
    onToggleStatus,
    onToggleActive,
    onClearFilters,
  } = filterState;

  const activeFilters = selectedStatuses.length + (onlyActive ? 1 : 0);

  const visibleIssues = titleFilter.trim()
    ? issuesData.filter((i) =>
        i.title.toLowerCase().includes(titleFilter.toLowerCase()),
      )
    : issuesData;

  const effectiveCount = (issue: Issue) =>
    locallyRead.has(issue.id) ? 0 : (questionCounts[issue.id] ?? 0);

  const modal = selectedIssue && (
    <IssueDetailModal
      issue={selectedIssue}
      onClose={() => setSelectedIssue(null)}
      questionCount={questionCounts[selectedIssue.id] ?? 0}
      onMarkedRead={() =>
        setLocallyRead((prev) => new Set([...prev, selectedIssue.id]))
      }
    />
  );

  if (compact) {
    return (
      <Card className="bg-background border-border flex flex-col w-full h-full">
        <CardHeader className="flex flex-row items-center justify-between flex-shrink-0 pt-[14px] pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-warning" />
            {title}
          </CardTitle>
          {issuesData.length > 0 && (
            <span className="text-xs text-muted-foreground tabular-nums">
              {issuesData.length} issue{issuesData.length === 1 ? "" : "s"}
            </span>
          )}
        </CardHeader>
        <CardContent className="flex-1 flex flex-col overflow-hidden px-2 pb-3">
          {visibleIssues.length === 0 ? (
            <p className="text-sm text-muted-foreground italic px-1">
              No issues.
            </p>
          ) : (
            <div className="flex flex-col gap-0.5 flex-1 min-h-0 overflow-y-auto scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
              {visibleIssues.map((issue) => (
                <IssueListRow
                  key={issue.id}
                  issue={issue}
                  onOpen={() => setSelectedIssue(issue)}
                  questionCount={effectiveCount(issue)}
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
    <Card className="bg-background border-border h-full flex flex-col w-full">
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
            {filterOpen && (
              <div
                className="absolute right-0 top-full mt-2 z-50 w-64 rounded-xl border border-border bg-background shadow-xl p-4 space-y-4"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
                role="menu"
                tabIndex={0}
              >
                {hasCycles && (
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                      Cycle
                    </p>
                    <button
                      onClick={onToggleActive}
                      className={`text-xs px-3 py-1.5 rounded-full border transition-colors font-medium ${
                        onlyActive
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-muted/50 text-muted-foreground border-border hover:bg-muted"
                      }`}
                    >
                      Active cycle only
                    </button>
                  </div>
                )}

                {availableStatuses.length > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                      Status
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {availableStatuses.map((status) => {
                        const active = selectedStatuses.includes(status);
                        return (
                          <button
                            key={status}
                            onClick={() => onToggleStatus(status)}
                            className={`text-[11px] px-2.5 py-1 rounded-full border font-medium transition-all ${
                              active
                                ? `${statusColors[status as keyof typeof statusColors]} border-current opacity-100`
                                : "bg-muted/40 text-muted-foreground border-border hover:bg-muted opacity-70 hover:opacity-100"
                            }`}
                          >
                            {status}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {activeFilters > 0 && (
                  <button
                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                    onClick={onClearFilters}
                  >
                    <span className="text-base leading-none">×</span> Clear all
                    filters
                  </button>
                )}
              </div>
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
              grid
              gap-4
              pb-2
              scrollbar-thin
              scrollbar-thumb-border
              scrollbar-track-transparent
              ${
                expanded
                  ? `grid-flow-row grid-cols-[repeat(auto-fill,minmax(280px,1fr))] auto-rows-auto overflow-visible h-auto`
                  : `grid-rows-[1fr_1fr] grid-flow-col auto-cols-[280px] overflow-x-auto h-full`
              }
            `}
          >
            {visibleIssues.map((issue) => (
              <IssueCard
                key={issue.id}
                issue={issue}
                onOpen={() => setSelectedIssue(issue)}
                onOpenChat={onOpenChat}
                questionCount={effectiveCount(issue)}
              />
            ))}
          </div>
        )}
      </CardContent>
      {modal}
    </Card>
  );
}
