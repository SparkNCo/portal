"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ArrowRight, Send, ChevronsRight, Filter } from "lucide-react";
import { Button } from "@/components/components/ui/button";
import { useRef, useState } from "react";

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

export type PriorityTasksProps = {
  issuesData: Issue[];
};

const STATE_TRANSITIONS: Partial<Record<string, string>> = {
  "Business Review": "UAT",
  UAT: "Done",
};

function IssueCard({ issue }: { issue: Issue }) {
  const [cardExpanded, setCardExpanded] = useState(false);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [currentStateName, setCurrentStateName] = useState(issue.state?.name);

  const nextState = currentStateName
    ? STATE_TRANSITIONS[currentStateName]
    : undefined;

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

  const latestComment = issue.comments?.nodes?.at(-1);

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

  return (
    <div
      className="flex-shrink-0 w-[280px] rounded-lg border border-border bg-secondary/30 hover:bg-secondary/50 transition-colors cursor-pointer"
      onClick={() => setCardExpanded((v) => !v)}
    >
      {/* Collapsed header — always visible */}
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

      {/* Expanded body */}
      {cardExpanded && (
        <div
          className="border-t border-border px-4 pb-4 pt-3 flex flex-col gap-3"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Title + status recap */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground line-clamp-1 flex-1">
              {issue.title}
            </span>
            <Badge
              variant="secondary"
              className={`text-[10px] ${statusColors[issue?.state?.name as keyof typeof statusColors]}`}
            >
              {issue?.state?.name}
            </Badge>
          </div>

          {/* Latest comment */}
          <div className="rounded-md bg-muted/40 p-3 min-h-[60px]">
            {latestComment ? (
              <div className="space-y-1">
                {latestComment.user?.displayName && (
                  <p className="text-[10px] font-medium text-muted-foreground">
                    {latestComment.user.displayName}
                  </p>
                )}
                <p className="text-sm text-foreground whitespace-pre-wrap">
                  {extractTextFromBodyData(latestComment.bodyData)}
                </p>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">
                No comments yet.
              </p>
            )}
          </div>

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

          {/* Comment input */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-2">
            <textarea
              className="w-full rounded-md border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground p-2 resize-none focus:outline-none focus:ring-1 focus:ring-ring"
              rows={3}
              placeholder="Add a comment..."
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
              Send
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}


export function PriorityTasks({ issuesData }: PriorityTasksProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [onlyActive, setOnlyActive] = useState(false);

  const hasCycles = issuesData.some((i) => i.cycle !== undefined);
  const availableStatuses = Array.from(new Set(issuesData.map((i) => i.state?.name).filter(Boolean))) as string[];

  const filtered = issuesData.filter((issue) => {
    if (onlyActive && issue.cycle && !issue.cycle.isActive) return false;
    if (selectedStatuses.length > 0 && (!issue.state?.name || !selectedStatuses.includes(issue.state.name))) return false;
    return true;
  });

  function toggleStatus(status: string) {
    setSelectedStatuses((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    );
  }

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
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={() => setFilterOpen((v) => !v)}
            >
              <Filter className="h-3 w-3 mr-1" />
              Filter
              {activeFilters > 0 && (
                <span className="ml-1 rounded-full bg-primary text-primary-foreground text-[10px] w-4 h-4 flex items-center justify-center">
                  {activeFilters}
                </span>
              )}
            </Button>
            {filterOpen && (
              <div
                className="absolute right-0 top-full mt-1 z-50 w-56 rounded-lg border border-border bg-background shadow-lg p-3 space-y-3"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
                role="menu"
                tabIndex={0}
              >
                {hasCycles && (
                  <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={onlyActive}
                      onChange={() => setOnlyActive((v) => !v)}
                      className="rounded"
                    />
                    Active cycle only
                  </label>
                )}
                <div onClick={() => console.log({ filtered })}>VER filtered</div>
                
                {availableStatuses.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Status</p>
                    {availableStatuses.map((status) => (
                      <label key={status} className="flex items-center gap-2 text-sm cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={selectedStatuses.includes(status)}
                          onChange={() => toggleStatus(status)}
                          className="rounded"
                        />
                        <Badge
                          variant="secondary"
                          className={`text-[10px] ${statusColors[status as keyof typeof statusColors]}`}
                        >
                          {status}
                        </Badge>
                      </label>
                    ))}
                  </div>
                )}
                {activeFilters > 0 && (
                  <button
                    className="text-xs text-muted-foreground hover:text-foreground underline w-full text-left"
                    onClick={() => { setSelectedStatuses([]); setOnlyActive(false); }}
                  >
                    Clear filters
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
      <CardContent className="flex-1 overflow-hidden" onClick={() => filterOpen && setFilterOpen(false)}>
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground italic p-2">No issues match the current filters.</p>
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
            {filtered.map((issue) => (
              <IssueCard key={issue.id} issue={issue} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
