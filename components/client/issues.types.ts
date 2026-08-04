import type { ReactNode } from "react";

export const priorityColors = {
  Urgent: "bg-destructive/20 text-destructive border-destructive/30",
  High: "bg-warning/20 text-warning border-warning/30",
  Medium: "bg-accent/20 text-accent border-accent/30",
  Low: "bg-muted/50 text-muted-foreground border-muted",
};

export const statusColors = {
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

export const STATUS_ORDER = [
  "Backlog",
  "Planning",
  "Business Review",
  "Development",
  "QA",
  "UAT",
  "Done",
];

// Raw color values (not Tailwind classes) for charts that need an actual
// `fill`/`stroke` value — shared so "Project Stats" and "Issues by Status"
// never disagree on which color a given status is. Keyed by name (not
// index/position) so a status is always the same color everywhere,
// regardless of what else is present in a given chart's data.
export const CHART_STATUS_COLORS: Record<string, string> = {
  Completed: "hsl(var(--success))",
  Done: "hsl(var(--success))",
  "In Progress": "hsl(var(--warning))",
  "In Review": "hsl(var(--warning))",
  Blocked: "hsl(var(--destructive))",
  "Not Started": "hsl(var(--muted))",
  Todo: "hsl(var(--muted))",
  Canceled: "hsl(var(--muted))",
  Backlog: "hsl(0, 0%, 30%)",
  Planning: "hsl(50, 90%, 35%)",
  "Business Review": "hsl(320, 65%, 40%)",
  Development: "hsl(265, 60%, 45%)",
  QA: "hsl(210, 70%, 35%)",
  UAT: "hsl(180, 60%, 30%)",
};

export type Decision = {
  id: string;
  issue_id: string;
  owner_email: string;
  question: string;
  decision: string | null;
  decision_by: string | null;
  decided_at: string | null;
  posted_to_linear: boolean;
  created_at: string;
};

export type TestCase = {
  id: string;
  title: string;
  steps: { order: number; description: string }[];
  expected: string;
  actual?: {
    text: string;
    recorded_by?: string | null;
    recorded_at?: string;
    kind?: "qa" | "uat";
    attachments?: { name: string; url: string }[];
  }[];
  status: "draft" | "approved" | "passed" | "failed";
  created_by: string;
  approved_by?: string;
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
  labels?: { nodes: { id: string; name: string; color: string }[] };
  estimate?: number | null;
  createdAt?: string;
};

export type FilterState = {
  selectedStatuses: string[];
  onlyActive: boolean;
  availableStatuses: string[];
  hasCycles: boolean;
  onToggleStatus: (s: string) => void;
  onToggleActive: () => void;
  onClearFilters: () => void;
  selectedLabels?: string[];
  availableLabels?: string[];
  onToggleLabel?: (l: string) => void;
  selectedPriorities?: string[];
  availablePriorities?: string[];
  onTogglePriority?: (p: string) => void;
  dateFrom?: string;
  dateTo?: string;
  onDateFromChange?: (date: string) => void;
  onDateToChange?: (date: string) => void;
};

export type PriorityTasksProps = {
  issuesData: Issue[];
  filterState: FilterState;
  onOpenChat?: (title: string) => void;
  onEditIssue?: (issue: Issue) => void;
  title?: string;
  compact?: boolean;
  headerAction?: ReactNode;
  // Which customer these issues belong to — passed through to the issue
  // detail modal's Chat tab so a brand-new chat group gets tagged with the
  // right customer even when a developer/admin (not the customer) sends the
  // first message. Omit it on pages spanning multiple customers (e.g. the
  // developer dashboard) — each issue there already carries its own
  // `_project` (clientName), which the modal falls back to per-issue.
  slug?: string;
};
