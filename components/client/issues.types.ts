import type { ReactNode } from "react";

// Low -> High escalates through the orange family (lightest to most
// intense/red-leaning); Urgent stays destructive red as the tier beyond High.
export const priorityColors = {
  Urgent: "bg-destructive/20 text-destructive border-destructive/30",
  High: "bg-chart-1/20 text-chart-1 border-chart-1/30",
  Medium: "bg-primary/20 text-primary border-primary/30",
  Low: "bg-chart-5/20 text-chart-5 border-chart-5/30",
  "No priority": "bg-muted/50 text-muted-foreground border-muted",
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
// Same hue families as the status "plates" on the Bugs list / issue cards
// (`statusColors` above), but a couple steps lighter/brighter — that map's
// raw shades (orange-600, blue-700, etc.) read as muddy against the chart's
// #111111 background. Business Review and Development share one orange in
// `statusColors`, but that made them indistinguishable here, so they're
// deliberately split into a rosier red vs. a warmer amber instead of copied
// 1:1.
export const CHART_STATUS_COLORS: Record<string, string> = {
  Completed: "hsl(var(--success))",
  Done: "hsl(var(--success))",
  "In Progress": "hsl(var(--warning))",
  "In Review": "#38bdf8", // sky-400
  Blocked: "hsl(var(--destructive))",
  // Same red as Blocked — matches its own badge color in `statusColors`
  // above, and reads as "negative outcome" rather than a neutral no-op.
  Canceled: "hsl(var(--destructive))",
  // "Hasn't started yet" cluster — the dedicated neutral chart gray, tuned
  // to actually show up against the #111111 page background (the old
  // `--muted`/hardcoded values here were near-black and barely visible).
  // Left as-is (not matched to statusColors' generic muted-foreground) for
  // that same visibility reason.
  "Not Started": "hsl(var(--donut))",
  Todo: "hsl(var(--donut))",
  Backlog: "hsl(var(--donut))",
  // Active-workflow stages.
  Planning: "#fde047", // yellow-300
  "Business Review": "#fb7185", // rose-400 — redder/pinker
  Development: "#fb923c", // orange-400 — pushed further from Planning's yellow
  QA: "#60a5fa", // blue-400
  UAT: "#2dd4bf", // teal-400
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

export type TestStep = { order: number; description: string };

// A reusable test definition — no longer tied to one ticket. Attaching it to a ticket
// creates a TestExecution (see below).
export type Test = {
  id: string;
  project_slug: string | null;
  title: string;
  steps: TestStep[];
  last_passed_execution_id: string | null;
  created_by: string;
  created_at: string;
};

export type TestExecutionResult = {
  text: string;
  recorded_by?: string | null;
  recorded_at?: string;
  kind?: "qa" | "uat";
  attachments?: { name: string; url: string }[];
};

// One attachment of a Test to one ticket: the expected behaviour for that ticket, its
// status, and the accumulated QA/UAT results recorded against it.
export type TestExecution = {
  id: string;
  test_id: string;
  issue_id: string;
  expected: string;
  status: "draft" | "approved" | "passed" | "failed";
  results: TestExecutionResult[];
  created_by: string;
  approved_by?: string;
  // Merged in by GET /test-executions — the reusable test's own title/steps.
  test: Pick<Test, "title" | "steps"> | null;
};

export type Issue = {
  id: string;
  branchName: string;
  priorityLabel: "Urgent" | "High" | "Medium" | "Low" | "No priority";
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
  project?: { id: string; name: string; slugId?: string };
  // Client-side tag (not from the API) added by pages that merge issues
  // across multiple customers, e.g. the developer dashboard — holds the
  // owning customer's `clientName`.
  _project?: string;
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
  // Renders the compact row list on the light-card surface (see .light-card in
  // globals.css) instead of the default dark bg-background rows — opt-in per
  // panel rather than a global IssueListRow change.
  lightCard?: boolean;
  headerAction?: ReactNode;
  // Optional sort control rendered next to the Filter button — omit both to
  // leave sorting out of the toolbar entirely (pages that sort elsewhere).
  sortBy?: "updated" | "priority";
  onSortByChange?: (value: "updated" | "priority") => void;
  // Which customer these issues belong to — passed through to the issue
  // detail modal's Chat tab so a brand-new chat group gets tagged with the
  // right customer even when a developer/admin (not the customer) sends the
  // first message. Omit it on pages spanning multiple customers (e.g. the
  // developer dashboard) — each issue there already carries its own
  // `_project` (clientName), which the modal falls back to per-issue.
  slug?: string;
};
