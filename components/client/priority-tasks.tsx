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
import { supabase } from "@/lib/supabase-client";

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

export type Answer = {
  email: string;
  body: string;
  created_at: string;
};

export type Decision = {
  id: string;
  issue_id: string;
  owner_email: string;
  question: string;
  answers: Answer[];
  decisions: { body: string; email: string; created_at: string } | null;
  posted_to_linear: boolean;
  created_at: string;
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

const STATUS_ORDER = [
  "Backlog",
  "Planning",
  "Business Review",
  "Development",
  "QA",
  "UAT",
  "Done",
];

const getNextState = (current: string | undefined): string | undefined => {
  if (!current) return undefined;
  const idx = STATUS_ORDER.indexOf(current);
  if (idx === -1 || idx === STATUS_ORDER.length - 1) return undefined;
  return STATUS_ORDER[idx + 1];
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
      {onOpenChat && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onOpenChat(chatTitle);
          }}
          className="text-muted-foreground hover:text-accent transition-colors opacity-0 group-hover:opacity-100"
          title="Open chat about this issue"
        >
          <MessageSquare className="h-3.5 w-3.5" />
        </button>
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
  const [question, setQuestion] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [currentStateName, setCurrentStateName] = useState(issue.state?.name);
  const [showDescription, setShowDescription] = useState(true);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [loadingDecisions, setLoadingDecisions] = useState(true);
  const [showQuestionForm, setShowQuestionForm] = useState(false);
  const [activeForm, setActiveForm] = useState<{
    decisionId: string;
    mode: "answer" | "decision";
  } | null>(null);
  const [formText, setFormText] = useState("");
  const [postingLinearId, setPostingLinearId] = useState<string | null>(null);

  const nextState = getNextState(currentStateName);

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    supabase
      .from("decisions")
      .select("*")
      .eq("issue_id", issue.id)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (data) setDecisions(data as Decision[]);
        setLoadingDecisions(false);
      });

    if (profile?.email) {
      fetch(`${process.env.NEXT_PUBLIC_ENDPOINT}/decisions/read`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_APIKEY}`,
          apikey: process.env.NEXT_PUBLIC_APIKEY!,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ issue_id: issue.id, user_email: profile.email }),
      }).then(() => onMarkedRead?.());
    }
  }, [issue.id]);

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

  async function handlePostToLinear(decisionId: string, question: string, questionEmail: string, decisionBody: string, decisionEmail: string) {
    setPostingLinearId(decisionId);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_ENDPOINT}/issues/linear-comment`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_APIKEY}`,
          apikey: process.env.NEXT_PUBLIC_APIKEY!,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ issueId: issue.id, decisionId, question, questionEmail, decisionBody, decisionEmail }),
      });
      if (res.ok) {
        setDecisions((prev) =>
          prev.map((d) => (d.id === decisionId ? { ...d, posted_to_linear: true } : d))
        );
      }
    } finally {
      setPostingLinearId(null);
    }
  }

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
    if (!question.trim() || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_ENDPOINT}/issues`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_APIKEY}`,
          apikey: process.env.NEXT_PUBLIC_APIKEY!,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          issueId: issue.id,
          question: question.trim(),
          ownerEmail: profile?.email,
        }),
      });
      const newDecision = await res.json();
      if (newDecision.id) setDecisions((prev) => [...prev, newDecision]);
      setQuestion("");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAddAnswer(decisionId: string) {
    if (!formText.trim() || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_ENDPOINT}/issues`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_APIKEY}`,
          apikey: process.env.NEXT_PUBLIC_APIKEY!,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          decisionId,
          answer: formText.trim(),
          answererEmail: profile?.email,
        }),
      });
      const updated = await res.json();
      if (updated.id) {
        setDecisions((prev) =>
          prev.map((d) => (d.id === updated.id ? updated : d)),
        );
      }
      setFormText("");
      setActiveForm(null);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSetDecision(decisionId: string) {
    if (!formText.trim() || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_ENDPOINT}/issues/decision`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_APIKEY}`,
            apikey: process.env.NEXT_PUBLIC_APIKEY!,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ decisionId, decision: formText.trim(), decisionEmail: profile?.email }),
        },
      );
      const updated = await res.json();
      if (updated.id) {
        setDecisions((prev) =>
          prev.map((d) => (d.id === updated.id ? updated : d)),
        );
      }
      setFormText("");
      setActiveForm(null);
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

          {/* Questions */}
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Questions {decisions.length > 0 && `(${decisions.length})`}
            </p>
            {loadingDecisions && (
              <p className="text-xs text-muted-foreground italic">Loading…</p>
            )}
            {!loadingDecisions && decisions.length === 0 && (
              <p className="text-xs text-muted-foreground italic">
                No questions yet.
              </p>
            )}
            {!loadingDecisions && decisions.length > 0 && (
              <div className="space-y-3">
                {decisions.map((d) => (
                  <div
                    key={d.id}
                    className="rounded-lg bg-muted/40 p-3 space-y-2"
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge
                        variant="secondary"
                        className="text-[10px] font-medium"
                      >
                        {d.owner_email}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(d.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-foreground whitespace-pre-wrap">
                      {d.question}
                    </p>

                    {d.answers.length > 0 && (
                      <div className="space-y-1.5 pl-3 border-l border-border">
                        {d.answers.map((a) => (
                          <div
                            key={`${a.email}-${a.created_at}`}
                            className="space-y-0.5"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-medium text-muted-foreground">
                                {a.email}
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                {new Date(a.created_at).toLocaleDateString()}
                              </span>
                            </div>
                            <p className="text-xs text-foreground whitespace-pre-wrap">{a.body}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {d.decisions?.body && (
                      <div className="rounded bg-success/10 p-2 space-y-0.5">
                        <p className="text-xs font-medium text-success whitespace-pre-wrap">{d.decisions.body}</p>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-success/70">{d.decisions.email}</span>
                          <span className="text-[10px] text-success/70">{new Date(d.decisions.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    )}

                    {activeForm?.decisionId === d.id ? (
                      <div className="flex flex-col gap-1.5">
                        <textarea
                          className="w-full rounded border border-border bg-secondary/30 text-xs p-2 resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                          rows={2}
                          placeholder={
                            activeForm.mode === "decision"
                              ? "Describe the decision reached…"
                              : "Your answer…"
                          }
                          value={formText}
                          onChange={(e) => setFormText(e.target.value)}
                          autoFocus
                        />
                        <div className="flex gap-1 justify-end">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setActiveForm(null);
                              setFormText("");
                            }}
                            className="text-xs h-6 px-2"
                          >
                            Cancel
                          </Button>
                          {activeForm.mode === "decision" ? (
                            <Button
                              size="sm"
                              onClick={() => handleSetDecision(d.id)}
                              disabled={!formText.trim() || submitting}
                              className="text-xs h-6 px-2 bg-green-600 hover:bg-green-700 text-white"
                            >
                              Confirm decision
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              onClick={() => handleAddAnswer(d.id)}
                              disabled={!formText.trim() || submitting}
                              className="text-xs h-6 px-2"
                            >
                              <Send className="h-2.5 w-2.5 mr-1" />
                              Answer
                            </Button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="flex justify-between gap-2 pt-1">
                        {!d.decisions?.body && (
                          <button
                            onClick={() => {
                              setActiveForm({ decisionId: d.id, mode: "answer" });
                              setFormText("");
                            }}
                            className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                          >
                            + Add answer
                          </button>
                        )}
                        <div className="flex items-center gap-1.5">
                          {d.decisions?.body && (() => {
                            const linearLabel = postingLinearId === d.id ? "Posting…" : d.posted_to_linear ? "Posted" : "Post in Linear";
                            return (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handlePostToLinear(d.id, d.question, d.owner_email, d.decisions!.body, d.decisions!.email)}
                                disabled={postingLinearId === d.id || d.posted_to_linear}
                                className="text-xs h-7 px-3"
                              >
                                {linearLabel}
                              </Button>
                            );
                          })()}
                          {!d.posted_to_linear && <Button
                            size="sm"
                            onClick={() => {
                              setActiveForm({ decisionId: d.id, mode: "decision" });
                              setFormText(d.decisions?.body ?? "");
                            }}
                            className="text-xs h-7 px-3 bg-green-600 hover:bg-green-700 text-white"
                          >
                            {d.decisions?.body ? "Update decision" : "Make decision"}
                          </Button>}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer — question input */}
        <div className="border-t border-border p-4">
          {showQuestionForm ? (
            <form onSubmit={handleSubmit} className="flex flex-col gap-2">
              <textarea
                className="w-full rounded-lg border border-border bg-secondary/30 text-sm text-foreground placeholder:text-muted-foreground p-2.5 resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                rows={3}
                placeholder="What needs a decision?"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey))
                    handleSubmit(e as any);
                }}
                autoFocus
              />
              <div className="flex gap-2 justify-end">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setShowQuestionForm(false);
                    setQuestion("");
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={!question.trim() || submitting}
                >
                  <Send className="h-3 w-3 mr-1" />
                  {submitting ? "Sending…" : "Ask"}
                </Button>
              </div>
            </form>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              onClick={() => setShowQuestionForm(true)}
            >
              <MessageSquare className="h-3 w-3 mr-1.5" />
              Ask a question
            </Button>
          )}
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

  return (
    <Card className="bg-background border-border flex flex-col w-full overflow-hidden">
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
