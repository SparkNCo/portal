"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  ArrowRight,
  Send,
  ChevronsRight,
  Filter,
  X,
} from "lucide-react";
import { Button } from "@/components/components/ui/button";
import { useEffect, useRef, useState } from "react";

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
  bodyData: string;
  createdAt?: string;
  user?: { displayName: string };
};

function extractTextFromBodyData(bodyData: string): string {
  try {
    const doc = JSON.parse(bodyData);
    const texts: string[] = [];
    function walk(node: any) {
      if (node.type === "text" && typeof node.text === "string") {
        texts.push(node.text);
      }
      if (Array.isArray(node.content)) {
        node.content.forEach(walk);
      }
    }
    walk(doc);
    return texts.join(" ").trim();
  } catch {
    return bodyData;
  }
}

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
};

const STATE_TRANSITIONS: Partial<Record<string, string>> = {
  "Business Review": "UAT",
  UAT: "Done",
};

function IssueCard({ issue, onOpen }: { issue: Issue; onOpen: () => void }) {
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
        </div>
        <p className="text-sm font-medium text-background-foreground mb-3 line-clamp-2">
          {issue.title}
        </p>
        <div className="flex items-center justify-between">
          <Badge
            variant="secondary"
            className={
              statusColors[issue?.state?.name as keyof typeof statusColors]
            }
          >
            {issue?.state?.name}
          </Badge>
        </div>
      </div>
    </div>
  );
}

function IssueDetailModal({
  issue,
  onClose,
}: {
  issue: Issue;
  onClose: () => void;
}) {
  const [visible, setVisible] = useState(false);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [currentStateName, setCurrentStateName] = useState(issue.state?.name);

  const nextState = currentStateName
    ? STATE_TRANSITIONS[currentStateName]
    : undefined;

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
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
      await fetch(`${process.env.NEXT_PUBLIC_ENDPOINT}/issues`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_APIKEY}`,
          apikey: process.env.NEXT_PUBLIC_APIKEY!,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ issueId: issue.id, body: comment.trim() }),
      });
      setComment("");
    } finally {
      setSubmitting(false);
    }
  }

  const comments = issue.comments?.nodes ?? [];

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center transition-all duration-200 ${
        visible ? "bg-black/60 backdrop-blur-sm" : "bg-transparent backdrop-blur-none"
      }`}
      onClick={handleClose}
    >
      <div
        className={`relative bg-background border border-border rounded-2xl shadow-2xl w-full max-w-lg mx-4 flex flex-col max-h-[85vh] transition-all duration-200 ${
          visible ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-2"
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
                  statusColors[
                    currentStateName as keyof typeof statusColors
                  ]
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

          {/* Comments */}
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Comments {comments.length > 0 && `(${comments.length})`}
            </p>
            {comments.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">
                No comments yet.
              </p>
            ) : (
              <div className="space-y-2">
                {comments.map((c) => (
                  <div
                    key={c.id}
                    className="rounded-lg bg-muted/40 p-3 space-y-0.5"
                  >
                    {c.user?.displayName && (
                      <p className="text-[10px] font-medium text-muted-foreground">
                        {c.user.displayName}
                        {c.createdAt && (
                          <span className="ml-2 font-normal">
                            {new Date(c.createdAt).toLocaleDateString()}
                          </span>
                        )}
                      </p>
                    )}
                    <p className="text-sm text-foreground whitespace-pre-wrap">
                      {extractTextFromBodyData(c.bodyData)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer — comment input */}
        <div className="border-t border-border p-4">
          <form onSubmit={handleSubmit} className="flex flex-col gap-2">
            <textarea
              className="w-full rounded-lg border border-border bg-secondary/30 text-sm text-foreground placeholder:text-muted-foreground p-2.5 resize-none focus:outline-none focus:ring-1 focus:ring-ring"
              rows={3}
              placeholder="Add a comment... (⌘+Enter to send)"
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

export function PriorityTasks({ issuesData, filterState }: PriorityTasksProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);

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

  return (
    <Card className="bg-background border-border h-full flex flex-col md:max-w-[50rem] lg:max-w-[100%]">
      <CardHeader className="flex flex-row items-center justify-between flex-shrink-0 pt-[14px] pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-warning" />
          Priority Tasks
        </CardTitle>
        <div className="flex items-center gap-1">
          <div className="relative">
            <Button
              variant={activeFilters > 0 ? "secondary" : "ghost"}
              size="sm"
              className="text-muted-foreground gap-1.5"
              onClick={() => setFilterOpen((v) => !v)}
            >
              <Filter className="h-3 w-3" />
              Filters
              {activeFilters > 0 && (
                <span className="rounded-full bg-primary text-primary-foreground text-[10px] w-4 h-4 flex items-center justify-center font-medium">
                  {activeFilters}
                </span>
              )}
            </Button>

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
                    <span className="text-base leading-none">×</span> Clear all filters
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
        {issuesData.length === 0 ? (
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
            {issuesData.map((issue) => (
              <IssueCard
                key={issue.id}
                issue={issue}
                onOpen={() => setSelectedIssue(issue)}
              />
            ))}
          </div>
        )}
      </CardContent>

      {selectedIssue && (
        <IssueDetailModal
          issue={selectedIssue}
          onClose={() => setSelectedIssue(null)}
        />
      )}
    </Card>
  );
}
