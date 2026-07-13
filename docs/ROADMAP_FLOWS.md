# Roadmap — Flows & How It Works

> Reference for the Roadmap page and all its panels.  
> Main page: `app/[slug]/dashboard/(portal)/roadmap/page.tsx` → `RoadmapPage`

---

## Who sees this page

The Roadmap is accessible to `customer`, `stakeholder`, and `admin` (when previewing a customer). It appears in the sidebar nav for those roles. Developers do not have a Roadmap link in their sidebar.

The URL follows the pattern `/{clientName}/dashboard/roadmap`.

---

## Data loaded on mount

A single query fetches everything the page needs:

### `GET /roadmap/?slug={slug}`

Returns the full roadmap for the customer's Linear workspace. The response contains a Linear **initiative** with its projects and their milestones:

```
roadmap.initiative.projects.nodes[]
  └── project.name
  └── project.projectMilestones.nodes[]
        └── milestone.name
        └── milestone.status
        └── milestone.progress
        └── milestone.targetDate
        └── milestone.createdAt
        └── milestone.description
        └── milestone.currentProgress { scopeCount, scopeEstimate, ... }
        └── milestone.issues.nodes[]  ← the issues inside this milestone
```

After the data loads, a `useEffect` flattens all milestones from all projects into a single `allMilestones[]` array, adding a `projectName` field to each milestone so the timeline knows which project it belongs to.

The slug resolution priority is the same as other pages: `CustomerSlugContext` → URL param → `profile.linear_slug`.

---

## Page Layout

The page renders three stacked sections:

```
┌───────────────────────┬───────────────────────┐
│  ProgressPieChart      │  SoftwareKPIs (DORA)   │
└───────────────────────┴───────────────────────┘
┌─────────────────────────────────────┐
│  Projects Timeline  (RoadmapTimeline)│
│   Year nav + project rows + bars    │
│   └── Milestone detail panel        │
│       └── Issue cards               │
│           └── IssueDetailModal      │
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│  MetricsPanel                        │
│   Filter bar (project, cycle, dates)│
│   ├── Cycle Scope vs Completed      │
│   └── Issues by Status (area chart) │
└─────────────────────────────────────┘
```

---

## Section 0 — Software KPIs (DORA Metrics)

**Source:** `components/roadmap/software-kpis.tsx`

### Data loading

`GET /get-dora-metrics?linear_name={slug}` — looks up `linear_slug` for the customer, then reads cached rows from `portal.dora_metrics` (one row per `linear_slug`, most recent `created_at` first).

### What it shows

Four DORA tiles, sourced from `averages` in the `dora_metrics` row:

| Tile | Field | Meaning |
|---|---|---|
| Change Failure Rate | `averages.change_failure_rate` | % of non-hotfix deployments followed immediately by a hotfix |
| Lead Time for Changes | `averages.lead_time_for_changes` | avg hours from branch creation to squash-merge, `feat/` branches only |
| Mean Time to Restore | `averages.mean_time_to_restore` | avg hours from branch creation to squash-merge, `fix/` branches only |
| Deploy Frequency | `averages.deploy_frequency` | count of `feat/`/`fix/` merges whose squash commit is reachable on `main`, last 30/90 days |

### Where the underlying data comes from

**None of it comes from GitHub issues.** Everything is derived from Git branch and commit history in the `dora` edge function — see [supabase/functions/dora/diagrams/dora-flow.mmd](../supabase/functions/dora/diagrams/dora-flow.mmd) for the full internal pipeline. In short:

1. A branch only counts if its name starts with `feat/` or `fix/` **and** contains a Linear id (e.g. `feat/SPA-123-add-login`) — the prefix must be on the **branch name**, not the PR title.
2. **Dev start** = the branch's creation timestamp, captured by the `github-webhook` function (GitHub `create` event) or, when no webhook is registered, approximated by `dora/events.ts` polling GitHub's own events feed, or — as a last resort — the earliest commit date on the PR.
3. **Dev completion** = the squash-merge timestamp, only counted once `isSquashMergeForPR` confirms it was actually a squash merge (not a regular merge commit or rebase).
4. **Deployment** = the moment the squash commit is confirmed reachable on `main` via GitHub's compare API — not gated by CI status.

`GET /issueMetrics/?slug={slug}` (Section 2 below) is a **separate, unrelated** data source — it's Linear cycle/issue data, not DORA.

---

## Section 1 — Projects Timeline

**Source:** `components/roadmap/roadmap-timeline.tsx`

### Year navigation

The timeline always shows one full calendar year at a time (January → December). The current year is the default. Left/right arrows in the header let the user step backwards or forwards by year. The current month is highlighted in the months header row.

### Project rows

Milestones are grouped by `projectName`. Each group renders as a **ProjectRow** with:

- A header showing the project name and an **Expand / Collapse** toggle.
- A timeline bar area divided into 12 columns (one per month).

#### Collapsed view — `ProjectSummaryBar`

When collapsed (the default), the project shows a single summary bar spanning the months between the earliest `createdAt` and the latest `targetDate` across all its milestones. Hovering over a month that has a milestone due shows a tooltip with the milestone name and status.

#### Expanded view — `MilestoneRow`

When expanded, each individual milestone gets its own row with a colored bar spanning from its `createdAt` month to its `targetDate` month. The bar color reflects the milestone status:

| Status | Color |
|---|---|
| `completed` | Green |
| `in-progress` | Blue (chart-1) |
| `planned` | Muted grey |
| `overdue` | Yellow/warning |
| `unstarted` | Accent |
| `next` | Accent |

The milestone name is shown as a badge on the left. Clicking a milestone row selects it (highlighted with `bg-accent/10`).

### Milestone detail panel

Clicking a milestone (in either collapsed or expanded view) opens a **detail panel** below the timeline card. It shows:

- Milestone name and project name
- A grid of all issues inside that milestone, each showing:
  - Issue identifier (e.g. `SPA-42`) and title
  - Status badge and priority badge
  - Labels
  - Assignee display name
  - Due date (if set)
  - Completed date (if completed)

Clicking a second time on the same milestone closes the panel. Clicking a different milestone switches to it.

### Opening an issue from the timeline

Clicking any issue card in the milestone detail panel opens the full **IssueDetailModal** — the same modal used on the client and developer dashboards — with Description, Chat, Tests, and Decisions tabs. See `app/docs/FEATURES_FLOWS.md` for the full modal interaction flows.

---

## Section 2 — Metrics Panel

**Source:** `components/metrics/metrics-panel.tsx`

### Data loading

A separate query fires for the metrics section: `GET /issueMetrics/?slug={slug}`.

The response contains two arrays:
- `issue_metrics[]` — issue counts and points per status, per cycle, per project
- `cycle_metrics[]` — cycle-level data including scope history, completed history, dates, and uncompleted issues

### Filter bar

Three controls let the user narrow the data:

| Control | What it does |
|---|---|
| **Project selector** | Dropdown of all projects found in `cycle_metrics`. Defaults to the first project. Filters both charts to that project only. |
| **Cycle selector** | Dropdown of all cycles for the selected project (newest first). Selecting a cycle also auto-fills the From/To date pickers with the cycle's start and end dates. |
| **Date range (From / To)** | Manually restricts the cycle data shown to cycles that overlap the selected window. A "Clear" link resets both dates. |

### Chart 1 — Cycle Scope vs Completed (`CycleBarChart`)

**Source:** `components/metrics/cycle-metrics.tsx`

A grouped **bar chart** showing, for each cycle in the filtered range:
- **Scope** — the total number of issues planned for that cycle (last value of `scope_history`)
- **Completed** — the number of issues actually completed (last value of `completed_scope_history`)

This gives an immediate visual of whether the team is consistently completing what they plan, or carrying issues over.

### Chart 2 — Issues by Status (`IssueMetricsView`)

**Source:** `components/metrics/issues-metrics.tsx`

A **stacked area chart** showing how issues were distributed across statuses over time for the selected cycle. Each status (Backlog, Planning, Development, QA, UAT, Done, etc.) is a stacked area with its own color.

The X axis is time (dates), the Y axis is the count of issues in each status on that day. This lets you see the flow of work through the pipeline — for example, whether issues piled up in QA or moved smoothly into Done.

On mobile, the legend is collapsed behind a "Legend" toggle button to save space.

---

## Components built but not currently rendered

The following components exist in `components/metrics/cycle-metrics.tsx` and are imported into `MetricsPanel` but are not rendered in the current UI. They are available to add back:

| Component | What it shows |
|---|---|
| `CycleHistoryChart` | Line chart of scope and completed-scope day by day across cycles. Supports Current/All toggle and a collapsible legend. |
| `CycleTable` | Table of all cycles with scope, completed, completion rate (green/yellow/red), and completed-at date. |
| `UncompletedIssuesList` | Table of issues that were left open when a cycle closed, sorted by priority. Flags issues that were carried over from the previous cycle. Filters out issues added after the cycle closed ("noise"). |

---

## Full data flow on page load

```
User lands on /{slug}/dashboard/roadmap
          │
          ├── AuthGate checks Supabase session → if invalid, redirect to /
          │
          ├── GET /roadmap/?slug={slug}
          │     → initiative.projects.nodes[] loaded
          │     → milestones flattened with projectName injected
          │     → allMilestones[] → RoadmapTimeline
          │
          ├── GET /get-dora-metrics?linear_name={slug}
          │     → dora_metrics row (averages, cfr/lead_time/mttr/deploy_freq details)
          │     → SoftwareKPIs renders the four DORA tiles
          │
          └── GET /issueMetrics/?slug={slug}
                → issue_metrics[] + cycle_metrics[] loaded
                → projects list extracted from cycle_metrics
                → defaults: first project, latest cycle
                → MetricsPanel renders CycleBarChart + IssueMetricsView
```

---

## File Map

| File | Responsibility |
|---|---|
| `app/[slug]/dashboard/(portal)/roadmap/page.tsx` | Main roadmap page — fetches roadmap data, renders all sections |
| `components/roadmap/software-kpis.tsx` | Software KPIs — fetches and renders the four DORA metric tiles |
| `components/roadmap/roadmap-timeline.tsx` | Timeline shell — year nav, project grouping, milestone selection, issue detail panel |
| `components/roadmap/ProjectRow.tsx` | Single project row — toggles between collapsed and expanded view |
| `components/roadmap/ProjectSummaryBar.tsx` | Collapsed summary bar + individual MilestoneRow bars |
| `components/roadmap/TimelineHeader.tsx` | Year navigation header + months label row |
| `components/metrics/metrics-panel.tsx` | Metrics section — filter bar + chart grid |
| `components/metrics/cycle-metrics.tsx` | CycleBarChart, CycleHistoryChart, CycleTable, UncompletedIssuesList |
| `components/metrics/issues-metrics.tsx` | Issues by Status stacked area chart |
| `components/client/issue-detail-modal.tsx` | Issue detail modal opened from the milestone issue grid |
| `context/CustomerSlugContext.tsx` | Provides the active customer slug when admin is previewing |
| `supabase/functions/dora/` | Backend: computes the 4 DORA metrics from Git branch/commit history — see [dora-flow.mmd](../supabase/functions/dora/diagrams/dora-flow.mmd) |
| `supabase/functions/get-dora-metrics/` | Read-only endpoint `SoftwareKPIs` calls — reads cached `dora_metrics` rows |
