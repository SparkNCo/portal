# Roadmap — Flows & How It Works

> Reference for the Roadmap page and all its panels.  
> Main page: `app/[slug]/(portal)/monitor/page.tsx` → `RoadmapPage`

---

## Who sees this page

The Roadmap is accessible to `customer`, `stakeholder`, and `admin` (when previewing a customer). It appears in the sidebar nav for those roles. Developers do not have a Roadmap link in their sidebar.

The URL follows the pattern `/{clientName}/monitor`.

---

## Data loaded on mount

Three independent queries fire when the page mounts:

### `GET /issues?slug={slug}` (via the shared `fetchIssues` helper)

The same issue-list fetch the Client/Developer dashboards use. Feeds `allIssues`, which is passed straight into `ProgressPieChart` ("Project Stats" — see `app/docs/CLIENT_DASHBOARD_FLOWS.md`, it's the identical donut/legend component). Nothing on this page merges it with the roadmap/milestone data below — it's purely for that one chart.

### `GET /roadmap/?slug={slug}`

Returns the customer's Linear **initiative** with its projects/milestones, plus (as of a later addition) the initiative's full **cycle** list:

```
{
  initiative: {
    id,
    projects: { nodes: [
      { id, name, targetDate, createdAt, currentProgress, description,
        startDate, startedAt, progress, progressHistory, priorityLabel,
        prioritySortOrder, content, status { name, position }, lead { displayName },
        projectMilestones: { nodes: [
          { id, name, status, targetDate, currentProgress, createdAt,
            progress, progressHistory, description,
            issues: { nodes: [ /* first 25 only — see cycle drill-down below */ ], pageInfo } }
        ] } }
    ] }
  },
  cycles: { nodes: [ { id, number, name, startsAt, endsAt, isActive, isPast, isFuture } ], pageInfo }
}
```

`cycles` is fetched separately from `projects`, because **cycles belong to a team, not a project**: the backend resolves the first project's team, then fetches that team's full cycle list (up to 100), on the assumption every project in an initiative shares one team. This is what drives the Projects Timeline's cycle columns (Section 1) — a completely different axis from the milestones' own `createdAt`/`targetDate` fields.

After the data loads, a `useEffect` flattens all milestones from all projects into a single `allMilestones[]` array, adding a `projectName` field to each milestone. A `projectIdsByName` map (project name → Linear project id) is also built, used to scope the cycle drill-down (Section 1) to one project.

The slug resolution priority is the same as other pages: `CustomerSlugContext` → URL param → `profile.linear_slug`.

### `GET /roadmap?cycleId=...` (on demand, not on mount)

A second, distinct use of the same `roadmap` function — fetches the *real, complete, team-wide* set of issues in one cycle (optionally narrowed to a project and/or milestone via `projectId`/`milestoneId` filters), paginated 25 at a time. This only fires when a cycle cell is clicked in the timeline (Section 1) — see "Cycle drill-down" below. It exists because each milestone's embedded `issues.nodes` above is capped at 25 and doesn't include issues outside that milestone that still belong to the same cycle.

---

## Page Layout

The page renders four stacked sections. Every one of them is individually **pinnable** to the viewer's own dashboard via a `PinButton` in its top-right corner (see "Pinned panels" below):

```
┌───────────────────────┬───────────────────────┐
│  ProgressPieChart      │  SoftwareKPIs (SDLC)   │
│  ("Project Stats")     │                       │
└───────────────────────┴───────────────────────┘
┌─────────────────────────────────────┐
│  Projects Timeline  (RoadmapTimeline)│
│   Cycle-column nav + project rows   │
│   └── Cycle details panel           │
│       (team-wide issues, filterable)│
│           └── IssueDetailModal      │
│           └── EditIssueModal        │
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│  MetricsPanel                        │
│   Filter bar (project, cycle, dates)│
│   ├── Cycle Scope vs Completed      │
│   └── Issues by Status (area chart) │
└─────────────────────────────────────┘
```

### Pinned panels

Each section's `PinButton` (`components/dashboard/pin-button.tsx`) toggles a row in `portal.pinned_panels` for the current panel id (`progress_pie_chart`, `software_kpis`, `roadmap_timeline`, `metrics_panel` — registered in `lib/pinnable-panels.ts` alongside three Build/Bugs panels). `usePinnedPanelsOwnerId()` resolves *whose* dashboard is being pinned to — the previewed customer's id when an admin/developer is inside the Dashboards preview, otherwise the caller's own. This is a cross-page feature (it also appears on Build and Bugs), so it isn't fully written up here — see `hooks/use-pinned-panels.ts` and `components/dashboard/pinned-panel-renderer.tsx`/`sortable-pinned-panel.tsx` for the rest of it if a dedicated doc is needed later.

---

## Section 0 — Software KPIs (SDLC Metrics)

**Source:** `components/roadmap/software-kpis.tsx`

> "SDLC Metrics" is the user-facing name only. The table (`dora_metrics`), the edge functions (`dora/`, `get-dora-metrics/`, `manual-metrics/`), and internal identifiers (`DoraMetric`, `dorametrics_id`, the `["dora-metrics"]` query key) still say "dora" — that rename hasn't happened yet.

### Data loading

`GET /get-dora-metrics?linear_name={slug}` — looks up `linear_slug` for the customer, then reads cached rows from `portal.dora_metrics` (one row per `linear_slug`, most recent `created_at` first).

### What it shows

Nine tiles in a 3x3 grid, sourced from `averages` in the `dora_metrics` row (plus two manually-entered columns):

| Tile | Field | Meaning |
|---|---|---|
| Deploy Frequency | `averages.deploy_frequency` | count of `feat/`/`fix/` merges whose squash commit is reachable on `main`, last 30/90 days |
| Lead Time for Changes | `averages.lead_time_for_changes` | avg hours from branch creation to squash-merge, `feat/` branches only |
| Mean Time to Restore | `averages.mean_time_to_restore` | how long the system was left broken: avg (this `fix/` branch's completion) − (the last `feat/` branch's close time before it) |
| Change Failure Rate | `averages.change_failure_rate` | % of non-hotfix deployments followed immediately by a hotfix |
| Feature Cycle Time | `averages.feature_cycle_time` | avg hours from branch creation to squash-merge, `feat/` branches only — currently the same computation as Lead Time |
| Fix Cycle Time | `averages.fix_cycle_time` | avg hours from branch creation to squash-merge, `fix/` branches only — how long the fix itself took, distinct from MTTR |
| Defect Escape Rate | `averages.defect_escape_rate` | `total fix/ branches / (total fix/ + total feat/ branches)` over all branch-event history |
| Code Coverage | `code_coverage_details.value` | manually entered by an admin/developer via `PATCH manual-metrics`, 0–100% — never computed |
| Sonar Quality Gate | `sonar_quality_gate_details.value` | manually entered by an admin/developer via `PATCH manual-metrics`, `pass`/`fail` — never computed |

Each tile is color-coded green/yellow/red against a good/mid/bad threshold per metric (`KPI_THRESHOLDS` in `software-kpis.tsx`), interpolated so in-between values render as in-between shades rather than snapping.

### Where the underlying data comes from

**None of it comes from GitHub issues.** The first seven tiles are derived from Git branch and commit history in the `dora` edge function — see [supabase/functions/dora/diagrams/dora-flow.mmd](../supabase/functions/dora/diagrams/dora-flow.mmd) for the full internal pipeline. In short:

1. A PR only qualifies if its **title** (`pr.title`, e.g. `feat/SPA-123-add-login`) starts with `feat/` or `fix/` **and** contains a Linear id (`parseQualifyingBranch`). This is checked against the PR **title**, not `pr.head.ref` — every PR here is opened staging→main, so `pr.head.ref` is always the literal string `"staging"` and carries no branch identity at all. The convention that makes this work is that the original working branch is created with the same name that later becomes the PR title.
2. **Dev start** = the branch's creation timestamp, looked up from `portal.dora_branch_events` by that same title-derived branch name, captured by the `github-webhook` function (GitHub `create` event) or, when no webhook is registered, approximated by `dora/events.ts` polling GitHub's own events feed, or — as a last resort — the earliest commit's *author* date on the PR (`dev_start_source: "first_commit_fallback"`).
3. **Dev completion** = the squash-merge timestamp, only counted once `isSquashMergeForPR` confirms it was actually a squash merge (the merge commit has exactly one parent and a SHA not matching any of the PR's own commits — rules out regular merge commits and rebases).
4. **Deployment** = the moment the squash commit is confirmed reachable on `main` via GitHub's compare API (`isCommitOnMain`) — not gated by CI status.

**Change Failure Rate has one extra qualifying path the other three don't:** `cfr.ts`'s `isCFRHotfix` flags a PR as a hotfix if `isHotfix` (title/label/commit starts with one of `ERROR_SIGNALS`: `revert`, `hotfix`, `rollback`, `bugfix`, `fix/`, `fix:`) is true, **or** the title matches `fix: SPA-<id>`, **or** — the newer addition — the title itself is a qualifying `fix/`-type branch title (`parseQualifyingBranch(pr.title)?.type === "fix"`). That third check exists because `fix/` PRs became first-class qualifying work for Lead Time/MTTR/Deploy Frequency (identical lifecycle rules to `feat/`) — CFR still needs every `fix/`-titled PR to register as "reactive work" even if nothing else about it looks like a hotfix.

`GET /issueMetrics/?slug={slug}` (Section 2 below) is a **separate, unrelated** data source — it's Linear cycle/issue data, not SDLC/dora metrics.

**Code Coverage and Sonar Quality Gate come from neither Git history nor GitHub issues — they're not integrated with anything.** Code Coverage is the test-coverage % from whatever coverage tool the customer's repo uses (Jest/Vitest + a coverage reporter, Istanbul, etc.); Sonar Quality Gate is the pass/fail result of that repo's SonarQube/SonarCloud Quality Gate check. An admin or developer has to read the value off the customer's own coverage report / Sonar dashboard and type it in — there's no webhook or API pull. The entry point is the "Edit" link on each tile in `SoftwareKPIs` (only visible to admin/developer roles), which calls `PATCH manual-metrics`.

### How `dora` gets triggered, and how metrics accumulate

`dora` runs on its **own cron**, independent of `issueMetrics` — `POST /dora { method: "allCustomers" }` → `handleAllCustomers`, which iterates every customer with a `linear_slug` and non-empty `project_url`. This was deliberately decoupled: GitHub's API is slower/more rate-limited than Linear's, so it shouldn't share a run or timeout budget with Linear-only metrics. (`issueMetrics/index.ts` no longer calls `dora` at the end of its own run, despite what an older comment in `createCustomerFlow.ts` still says — creating a new customer today only triggers `issueMetrics` immediately; their SDLC numbers populate on the next scheduled `dora` cron run, not instantly.)

**Since-window, per customer:** each run looks back at least 90 days (`MIN_LOOKBACK_DAYS`), and further than that if the customer's stored `dora_metrics.last_called` is older than 90 days — i.e. the window self-heals to cover however long it's actually been since that customer was last processed, rather than trusting a fixed short window. (This replaced an earlier fixed "last 24h" cutoff that could permanently drop merges from a missed cron run — the 90-day floor exists specifically so a gap of days-to-weeks still gets fully caught up on the next run.)

- **Change Failure Rate** and **Defect Escape Rate** are recomputed from scratch every run — CFR re-fetches the most recent `limit` merged PRs (default 100, no date filter), Defect Escape Rate re-counts all branch-event history — neither is a cumulative store.
- **Lead Time, MTTR, Deploy Frequency, Feature Cycle Time, and Fix Cycle Time** are cumulative: each run only fetches PRs merged within the since-window above, then appends new entries (deduped by `pr_number` against what's already stored in `dora_metrics`) — old entries are never dropped or recomputed, so the averages shown are over *all* accumulated samples, not just the current run's window.
- **Code Coverage and Sonar Quality Gate** are untouched by any `dora` run — they only change via a manual `PATCH` to `manual-metrics`.

---

## Section 1 — Projects Timeline

**Source:** `components/roadmap/roadmap-timeline.tsx`, `ProjectRow.tsx`, `ProjectSummaryBar.tsx`, `TimelineHeader.tsx`

This section was rebuilt around Linear **cycles** (sprints), not calendar months — it's no longer a year-at-a-glance Gantt view.

### Cycle-column navigation

The timeline's x-axis is a window of **5 cycles** at a time (2 before + the active one + 2 after), pooled from every project's shared team cycle list (deduped by `id`, sorted chronologically) and fetched from `roadmap.cycles` (see "Data loaded on mount" above). It defaults to centering on whichever cycle has `isActive: true` (or the most recent one if none is active). Left/right arrows ("Show earlier/later cycles") slide this 5-wide window across the full cycle history — they don't jump by year, and there's no concept of "the current year." Each column header shows the cycle number (`#N`) or name, with a tooltip on hover showing its actual date range; the active cycle is highlighted.

### Project rows

Milestones are grouped by `projectName`. Each group renders as a **ProjectRow** with a header (project name, milestone count, Expand/Collapse toggle) and a row of cells — one per visible cycle column. A project with zero milestones still gets a row (backed by a placeholder milestone) so it isn't silently missing from the timeline.

#### Collapsed view — `ProjectSummaryBar`

When collapsed (the default), each cycle cell is highlighted if **any** of the project's milestones have an issue that belongs to that cycle — determined by real cycle membership (`issue.cycle.id`) pulled from the milestone's own issue list, not by comparing date ranges (many milestones have no `targetDate` at all, so date math isn't reliable here). Hovering a highlighted cell shows a tooltip listing which milestone(s) fall in that cycle and their status. Clicking a cell opens the cycle drill-down panel (see below) scoped to the whole project.

#### Expanded view — `MilestoneRow`

When expanded, each milestone gets its own row of cycle cells. A cell is colored only if that milestone has an issue in that cycle:

| Condition | Color |
|---|---|
| Milestone's `progress >= 1` (fully done) | Green (`bg-success`) |
| Still open, past `targetDate` | Orange/warning (`bg-warning/50`) — overdue |
| Still open, not yet due (or no `targetDate`) | Blue/accent (`bg-accent/50`) |
| No issue in that cycle | Muted, no color |

This is computed from actual completion + due date, not from Linear's own `status` field on the milestone. The milestone name is shown as a badge on the left. Clicking a cell opens the drill-down scoped to that milestone specifically.

### Cycle drill-down panel

Clicking any cycle cell (project-level or milestone-level) opens a panel below the timeline showing the **real, complete set of issues in that cycle**, fetched fresh from Linear team-wide (`GET /roadmap?cycleId=...`, optionally narrowed by `projectId`/`milestoneId` depending on which cell was clicked) — not just whatever happened to already be loaded via the milestone's own (25-issue-capped) list. Clicking the same cell again, or the panel's ✕, closes it; clicking a different cell switches to it (resetting search/filters).

- **Pagination:** "Load more issues" appends the next page via the cursor Linear returns (`pageInfo.endCursor`/`hasNextPage`).
- **Search + filters:** a text search (title or identifier) plus status and priority pill filters, all client-side over whatever's currently loaded — options are derived from the loaded issues themselves, so only statuses/priorities actually present in this cycle show up as filter buttons.
- **Issue cards** show identifier, type icon (from labels), priority badge, title, estimate, status badge, other labels, assignee, due date, and completed date.

### Opening an issue from the timeline

Clicking an issue card opens the full **IssueDetailModal** — Description, Chat, Tests, Decisions, Demo, and (for non-bug issues) Design tabs too, same as everywhere else in the app (see `app/docs/FEATURES_FLOWS.md`). A **pencil/edit button** on each card (new alongside the drill-down rework) opens `EditIssueModal` directly instead, and on save invalidates the `["roadmap", slug]` query so the timeline reflects the change.

---

## Section 2 — Metrics Panel

**Source:** `components/metrics/metrics-panel.tsx`

### Data loading

A separate query fires for the metrics section: `GET /issueMetrics/?slug={slug}`.

The response contains two arrays:
- `issue_metrics[]` — issue counts and points per status, per cycle, per project
- `cycle_metrics[]` — cycle-level data including scope history, completed history, dates, uncompleted issues, and `issues_averages` — a day-by-day array of status-count snapshots (`{ date, [status]: count, ... }`) accumulated across every `issueMetrics` run for that cycle. This is the field that actually feeds the "Issues by Status" chart below; each day's snapshot is upserted in place (same date replaced, not duplicated) rather than appended forever.

### Filter bar

Three controls let the user narrow the data:

| Control | What it does |
|---|---|
| **Project selector** | Dropdown of all projects found in `cycle_metrics`. Defaults to the first project. Filters both charts to that project only. |
| **Cycle selector** | Dropdown of all cycles for the selected project (newest first). Selecting a cycle also auto-fills the From/To date pickers with the cycle's start and end dates. |
| **Date range (From / To)** | Manually restricts the cycle data shown to cycles that overlap the selected window. A "Clear" link resets both dates. |

**Which control "wins" when both are set:** `MetricsPanel` tracks which control the user *last touched directly* (`lastFilterTouched: "cycle" | "date"`). Picking a cycle auto-fills the date fields, but that doesn't count as a direct date edit — only actually typing into a date field does. If the date range was the last thing directly edited, "Issues by Status" switches from showing one cycle to **spanning every cycle whose snapshots fall in that range**, merging same-date entries across cycles (summed) into one series, and its heading suffix changes from `— Cycle #N` to `— All cycles in range`. Otherwise it stays pinned to the single selected/latest cycle.

### Chart 1 — Cycle Scope vs Completed (`CycleBarChart`)

**Source:** `components/metrics/cycle-metrics.tsx`

A grouped **bar chart** showing, for each cycle in the filtered range:
- **Scope** — the total number of issues planned for that cycle (last value of `scope_history`)
- **Completed** — the number of issues actually completed (last value of `completed_scope_history`)

This gives an immediate visual of whether the team is consistently completing what they plan, or carrying issues over.

### Chart 2 — Issues by Status (`IssueMetricsView`)

**Source:** `components/metrics/issues-metrics.tsx`

A **stacked area chart** showing how issues were distributed across statuses over time for the selected cycle (or across cycles — see "Which control wins" above). Statuses are drawn in a fixed order/color (`STATUS_ORDER`, `CHART_STATUS_COLORS` — the same lookup "Project Stats" uses on the Client Dashboard, so a status is always the same color everywhere) — **except `Backlog`, which is excluded here**: this chart is always scoped to a cycle (or cycles), and Backlog issues never belong to a cycle, so it would only ever render as a flat zero line/legend entry.

The X axis is time (dates), the Y axis is the count of issues in each status on that day. This lets you see the flow of work through the pipeline — for example, whether issues piled up in QA or moved smoothly into Done.

On mobile, the legend is collapsed behind a "Legend" toggle button to save space.

**Known gap:** a project with zero active Linear cycles on a given day gets **no `cycle_metrics` row written for that day at all** (`buildCycleMetrics` only ever iterates existing cycles) — indistinguishable from the pipeline having stopped, when it actually ran and just had nothing to report. A fix was drafted and verified but reverted before merging; see `app/docs/TICKET_CYCLE_METRICS_PLACEHOLDER.md` for the proposal if this needs picking back up.

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
User lands on /{slug}/monitor
          │
          ├── AuthGate checks Supabase session → if invalid, redirect to /
          │
          ├── GET /issues?slug={slug}  →  allIssues  →  ProgressPieChart ("Project Stats")
          │
          ├── GET /roadmap/?slug={slug}
          │     → initiative.projects.nodes[] + cycles.nodes[] loaded
          │     → milestones flattened with projectName injected → allMilestones[]
          │     → projectIdsByName map built
          │     → RoadmapTimeline windows the pooled cycles (2 before/after active)
          │
          ├── GET /get-dora-metrics?linear_name={slug}
          │     → dora_metrics row (averages, cfr/lead_time/mttr/deploy_freq details)
          │     → SoftwareKPIs renders the 9 SDLC tiles (3x3 grid)
          │     (read-only: this page load never triggers the dora pipeline itself —
          │      that only runs on its own separate cron, see Section 0)
          │
          ├── GET /issueMetrics/?slug={slug}
          │     → issue_metrics[] + cycle_metrics[] loaded
          │     → projects list extracted from cycle_metrics
          │     → defaults: first project, latest cycle
          │     → MetricsPanel renders CycleBarChart + IssueMetricsView
          │
          └── User clicks a cycle cell on the timeline (not on page load)
                → GET /roadmap?cycleId=...(&projectId=...&milestoneId=...)
                → team-wide issues for that cycle → drill-down panel
```

---

## File Map

| File | Responsibility |
|---|---|
| `app/[slug]/(portal)/monitor/page.tsx` | Main roadmap page — fetches issues/roadmap data, renders all sections |
| `components/client/progress-pie-chart.tsx` | "Project Stats" donut chart, shared with the Client Dashboard |
| `components/roadmap/software-kpis.tsx` | Software KPIs — fetches and renders the 9 SDLC metric tiles |
| `components/roadmap/roadmap-timeline.tsx` | Timeline shell — cycle-column windowing, project grouping, cycle-drill-down fetch/state, issue modals |
| `components/roadmap/ProjectRow.tsx` | Single project row — toggles between collapsed and expanded view, computes per-milestone cycle membership |
| `components/roadmap/ProjectSummaryBar.tsx` | Collapsed summary bar + individual `MilestoneRow` cycle cells |
| `components/roadmap/TimelineHeader.tsx` | Cycle-window prev/next header + cycle-column label row |
| `components/dashboard/pin-button.tsx` | Per-panel pin/unpin toggle shown on every section (cross-page feature, also used on Build/Bugs) |
| `hooks/use-pinned-panels.ts` | Pinned-panels data layer — owner resolution, pin/unpin/reorder/width mutations |
| `lib/pinnable-panels.ts` | Registry of pinnable panel ids/labels/source dashboards |
| `components/metrics/metrics-panel.tsx` | Metrics section — filter bar + chart grid |
| `components/metrics/cycle-metrics.tsx` | CycleBarChart, CycleHistoryChart, CycleTable, UncompletedIssuesList |
| `components/metrics/issues-metrics.tsx` | Issues by Status stacked area chart |
| `components/client/issue-detail-modal.tsx` | Issue detail modal opened from the cycle drill-down panel |
| `components/build/edit-issue-modal.tsx` | Edit modal opened from the same drill-down panel's pencil button |
| `context/CustomerSlugContext.tsx` | Provides the active customer slug when admin is previewing |
| `supabase/functions/roadmap/index.ts` | Backend: `GET ?slug=` (initiative + projects + milestones + team cycles) and `GET ?cycleId=` (team-wide, paginated cycle issues) |
| `supabase/functions/roadmap/query.ts` | The four Linear GraphQL queries backing the above (`PROJECTS_QUERY`, `PROJECT_TEAM_QUERY`, `TEAM_CYCLES_QUERY`, `CYCLE_ISSUES_QUERY`) |
| `supabase/functions/dora/` | Backend: computes 7 of the 9 SDLC metrics from Git branch/commit history, on its own cron (`allCustomers`) — see [dora-flow.mmd](../supabase/functions/dora/diagrams/dora-flow.mmd) |
| `supabase/functions/get-dora-metrics/` | Read-only endpoint `SoftwareKPIs` calls — reads cached `dora_metrics` rows |
| `supabase/functions/manual-metrics/` | `PATCH` endpoint for the 2 manually-entered SDLC metrics (Code Coverage, Sonar Quality Gate) |
| `supabase/functions/issueMetrics/` | Backend: builds `issue_metrics`/`cycle_metrics` from Linear cycle data — see [issueMetrics.mmd](../supabase/functions/issueMetrics/issueMetrics.mmd) |

**Unused in `supabase/functions/roadmap/`:** `getRoadMap.ts` (a fully commented-out Redis-caching prototype) and `redis.ts`/`saveGetRoadMapData.ts` are not imported by `index.ts` or anywhere else — dead code, left in place.
