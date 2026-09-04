# Client Dashboard — Flows & How It Works

> Reference for the client-facing dashboard and everything it renders.  
> Main page: `app/[slug]/(portal)/dashboard/page.tsx` → `ClientDashboard`

---

## Who sees this dashboard

The client dashboard is the landing page for users with `role === "customer"` or `role === "stakeholder"` after login. Both roles see the same page and the same data.

The URL follows the pattern `/{clientName}/dashboard`, where `clientName` is the slug stored on the user's profile (e.g. `/acme/dashboard`).

---

## Layout & Navigation

Every page inside the portal (client, developer, admin, roadmap, etc.) shares the same shell defined in `app/[slug]/(portal)/layout.tsx`. That layout wraps all content with two things:

- **AuthGate** — checks that a valid Supabase session exists. If not, redirects to `/`.
- **Sidebar** — the left navigation panel (60px wide on desktop, slide-in drawer on mobile).

### Sidebar nav items per role

The sidebar renders a different set of links depending on the logged-in user's role:

| Role | Navigation items |
|---|---|
| `customer` | Dashboard, Roadmap, Documents, Chat, Settings |
| `stakeholder` | Dashboard, Roadmap, Documents, Chat |
| `developer` | Developer, Chat, Documents |
| `admin` | Users, Dashboards, Chat |

The active link is highlighted based on the current URL path. On mobile, the sidebar closes automatically when a link is clicked.

The bottom of the sidebar always shows the user's email, their role, and a **Logout** button that calls `supabase.auth.signOut()` and redirects to `/`.

---

## Data loaded on mount

When `ClientDashboard` mounts, two separate queries fire:

### 1. Issues — `GET /issues?slug={slug}&ticket_statuses={...}`

Fetches all issues belonging to the customer's Linear workspace identified by `slug`. The slug is resolved in this order of priority:
1. `CustomerSlugContext` (set when an admin or developer is previewing a customer's dashboard)
2. `urlSlug` from the URL params
3. `profile.linear_slug` from the user's profile

The full list of issues is stored as `allIssues` and used by all four dashboard cards.

### 2. Decision counts — `GET /decisions/counts?user_email={email}`

Fetches the number of **unanswered questions** per issue for the logged-in user. This powers the yellow badge shown on issue cards when a developer has asked a question that hasn't been answered yet.

This query **refetches automatically every 30 seconds** so the badges stay up to date without a manual refresh.

---

## Project filter

At the top of the dashboard there is a row of **project filter buttons** — one for "All" and one per unique project found across the issues list (extracted from `issue.project.id / issue.project.name`).

- Clicking a project button toggles it on/off. Multiple projects can be selected at once.
- Clicking **All** clears the filter and shows every issue.
- The filter is local state only — no API call is made when switching.
- When a filter is active, all four dashboard cards only show issues that belong to the selected project(s).

---

## New project Request button

To the right of the project filters sits the **New project Request** button (`components/client/request-project-dialog.tsx`). Unlike the Build/Bugs pages, the Dashboard does not use `CreateIssue` — this button opens its own lightweight dialog instead:

- A blue info banner explains the flow: *"Tell us about your idea and we'll email our team the details — no need to set anything up yourself."*
- **Title** — required
- **Description** *(optional)* — rich text editor (same `RichTextEditor` used for Feature Request descriptions), so the client can format their idea

On submit, it calls `POST /project-requests` with `{ title, description?, requestedBy, slug }`. The backend (`supabase/functions/project-requests/`) does **not** touch Linear — it fetches every `portal.users` row with `role === "admin"` and emails each one the request details via Resend. A success toast confirms the email was sent and the dialog resets.

See `docs/FEATURES_FLOWS.md` (section "New Project Request") for the full flow, including the API contract.

---

## Dashboard Cards

The main content area is a **2-column grid** (stacks to 1 column on mobile) with four cards:

### 1. Project Stats — `ProgressPieChart`

**Source:** `components/client/progress-pie-chart.tsx`

Displays a donut chart showing how many issues are in each status (Backlog, Planning, Development, QA, UAT, Done, etc.). Each status slice has a distinct color.

Below the chart, a legend lists every status with its count. At the bottom there are two summary numbers:
- **Total Tasks** — the total count of all issues
- **Completion** — the percentage of issues in `Done` or `Completed` status

The chart is computed from `allIssues` entirely on the client — no extra API call.

### 2. SDLC Metrics — `SoftwareKPIs`

**Source:** `components/roadmap/software-kpis.tsx`

> "SDLC Metrics" is the user-facing name only — the table (`dora_metrics`), edge functions (`dora/`, `get-dora-metrics/`, `manual-metrics/`), and internal identifiers (`DoraMetric`, `dorametrics_id`, the `["dora-metrics"]` query key) still say "dora"; that rename hasn't happened.

Shows nine **engineering metrics** for the customer's team in a 3x3 grid, fetched from `GET /get-dora-metrics?linear_name={slug}` (plus two manually-entered ones):

| Metric | What it measures |
|---|---|
| **Deploy Frequency** | Count of `feat/`/`fix/` merges whose squash commit is confirmed reachable on `main`. Shows last 30-day and 90-day counts |
| **Lead Time for Changes** | Average hours from branch creation to squash-merge, `feat/` branches only |
| **MTTR** (Mean Time to Restore) | Average hours from (the last `feat/` branch's close time before this fix) to (this `fix/` branch's completion) — despite the classic DORA name, this is not literally "recovery from a production incident," but it does measure how long the system was left in a broken state, which is distinct from Fix Cycle Time below |
| **Change Failure Rate** | % of non-hotfix deployments immediately followed by a hotfix deployment |
| **Feature Cycle Time** | Average hours from branch creation to squash-merge, `feat/` branches only — currently the same computation as Lead Time for Changes (Lead Time hasn't yet been redefined to "staging→main merge time" per the newer spec) |
| **Fix Cycle Time** | Average hours from branch creation to squash-merge, `fix/` branches only — how long the fix itself took to write once started, distinct from MTTR above |
| **Defect Escape Rate** | `total fix/ branches / (total fix/ + total feat/ branches)`, counted over all branch-event history — the share of merged work that was a bug fix rather than a new feature |
| **Code Coverage** | Entered by hand by an admin or developer via `PATCH manual-metrics` (0–100%) — never computed |
| **Sonar Quality Gate** | Entered by hand by an admin or developer via `PATCH manual-metrics` (`pass`/`fail`) — never computed |

Each tile is color-coded green/yellow/red against a per-metric good/mid/bad threshold (`KPI_THRESHOLDS` in `software-kpis.tsx`), linearly interpolated so in-between values render as in-between shades.

If no metrics are available yet, the card shows "No metrics available."

**The first seven are not derived from GitHub issues.** They come from Git branch and commit history in `supabase/functions/dora/`. Full pipeline diagram: `supabase/functions/dora/diagrams/dora-flow.mmd`. Code Coverage and Sonar Quality Gate come from `supabase/functions/manual-metrics/` instead — see below.

**Calculation notes — Lead Time for Changes / MTTR:** a PR only counts if its **title** (`pr.title`, not `pr.head.ref`) starts with `feat/` (Lead Time) or `fix/` (MTTR) and contains a Linear id, e.g. `feat/SPA-123-add-login`. It's checked against the title because every PR here is opened staging→main, so `pr.head.ref` is always the literal string `"staging"` and carries no branch identity — the working branch is created with the same name that later becomes the PR title, which is what makes title-matching work. For each qualifying merged PR:
- **Dev start** (`branch_created_at`) — the branch-creation timestamp recorded in `portal.dora_branch_events`, captured by the `github-webhook` function (GitHub `create` event) or, when no webhook is registered, by `dora/events.ts` polling GitHub's events feed. If neither caught it, it falls back to the earliest commit date on the PR (`dev_start_source: "first_commit_fallback"` in the raw result).
- **Dev completion** — the merge timestamp, only counted once `isSquashMergeForPR` confirms the merge actually landed as a squash commit (a regular merge commit or rebase is excluded).
- The metric value is `dev_completed_at - branch_created_at` in hours, averaged across all matching branches.

See `supabase/functions/dora/lifecycle.ts` (shared by `leadTime.ts` and `mttr.ts`).

**Calculation notes — Deploy Frequency:** same title-based `feat/`/`fix/` qualification as above, plus confirmation via GitHub's compare API that the squash commit is reachable on `main` (`isCommitOnMain`). There is no CI-status gate. See `supabase/functions/dora/deployFreq.ts`.

**Calculation notes — Change Failure Rate:** the only metric that still looks at **all** merged PRs (not just `feat/`/`fix/`) and at PR title/commits/labels rather than a qualifying-branch check. A PR is treated as a "hotfix" when its title, labels, or commit messages start with `revert`, `hotfix`, `rollback`, `bugfix`, `fix/`, or `fix:`, or the title matches `fix: SPA-<id>`, **or** the title is itself a qualifying `fix/`-type title (added once `fix/` PRs became first-class qualifying work for the other three metrics, so CFR still flags them as "reactive work" even without any other hotfix signal). A non-hotfix deployment counts as "failed" if the next chronological deployment is a hotfix. See `supabase/functions/dora/cfr.ts` (`ERROR_SIGNALS`, `isHotfix` in `github.ts`) — unchanged by the Git-history migration.

**Calculation notes — Feature Cycle Time / Fix Cycle Time:** same `branch_created_at → dev_completed_at` join logic as Lead Time/MTTR above, just scoped to `feat/` (`featureCycleTime.ts`) and `fix/` (`fixCycleTime.ts`) branches respectively. Feature Cycle Time is, today, computationally identical to Lead Time for Changes — they'll diverge once Lead Time is redefined to "staging→main merge time."

**Calculation notes — MTTR vs. Fix Cycle Time:** these look similar but measure different things. MTTR (`mttr.ts`) does **not** use the fix branch's own creation time — it looks up the `closed_date` of the last `feat` branch that shipped before this fix (`getLastFeatClosedBefore` in `db.ts`) as the "incident start," then measures time until this fix completes. Fix Cycle Time (`fixCycleTime.ts`) measures only the fix branch's own lifetime (its own `branch_created_at → dev_completed_at`), i.e. how long the developer took to write the fix once they started it.

**Calculation notes — Defect Escape Rate:** `total_fix / (total_fix + total_feat)`, computed via `getBranchTypeCount` (`db.ts`) over all of that repo's `portal.dora_branch_events` history — not scoped to the run's since-window like the metrics above. See `supabase/functions/dora/defectEscape.ts`.

**Calculation notes — Code Coverage / Sonar Quality Gate:** not computed at all, and neither tool is integrated with the portal. Code Coverage is the test-coverage % from whatever coverage tool the customer's own repo uses (Jest/Vitest + a coverage reporter, Istanbul, etc.); Sonar Quality Gate is the pass/fail result of that repo's SonarQube/SonarCloud Quality Gate check. An admin or developer reads the value off the customer's coverage report / Sonar dashboard themselves and types it in — there's no webhook or API pull from either tool. `supabase/functions/manual-metrics/` exposes a `PATCH` that writes directly onto `dora_metrics.code_coverage_details`/`sonar_quality_gate_details`; the entry point in the UI is the "Edit" link on each tile in `SoftwareKPIs`, shown only to admin/developer roles. It only ever touches those two columns, so a scheduled `dora` cron run can never overwrite a manually-entered value, and vice versa this endpoint never affects any computed metric. The customer must already have a `dora_metrics` row (i.e. the `dora` cron has run at least once for them) before a value can be set.

**How `dora` is triggered:** on its **own cron**, decoupled from `issueMetrics` — `POST /dora { method: "allCustomers" }` iterates every customer with a `linear_slug` and `project_url`, since GitHub's API is slower/more rate-limited than Linear's and shouldn't share a run/timeout budget with it. (`issueMetrics` no longer triggers `dora` at the end of its own run — a stale comment to that effect still lives in `createCustomerFlow.ts`, but the code it describes is gone, so a newly created customer's SDLC numbers populate on the next `dora` cron run, not immediately.) Each run also polls GitHub's events feed for new branch-creation events before computing metrics. CFR and Defect Escape Rate are recomputed from scratch each run (CFR is a sliding window over the last `limit` merged PRs; Defect Escape Rate re-counts all branch-event history). Lead Time, MTTR, Deploy Frequency, Feature Cycle Time, and Fix Cycle Time are cumulative: each run fetches PRs merged within a since-window that's always **at least 90 days**, extended further back if that customer hasn't run successfully in longer than that — a self-healing floor that replaced an earlier fixed 24h window which could permanently drop merges from a missed run. Code Coverage and Sonar Quality Gate are untouched by any `dora` run.

### 3. Business Review — `PriorityTasks` (Business Review)

**Source:** `components/client/priority-tasks.tsx` + `components/client/issue-detail-modal.tsx`

Shows all issues currently in the **Business Review** state. These are issues where the team has written the user stories and acceptance criteria and is waiting for the client to review and approve them before development starts.

Issues are sorted by question count — those with the most unanswered questions appear first.

Clicking any issue card opens the **Issue Detail Modal** with up to six tabs: Description, Chat, Tests, Decisions, Design, and Demo (Design is hidden for Bug issues; Demo shows for both). See `app/docs/FEATURES_FLOWS.md` for the full interaction flows inside the modal.

The **chat icon** on each card navigates to the Chat page with that issue pre-selected (via `?newChat=...` query param).

### 4. Acceptance Testing — `PriorityTasks` (UAT)

**Source:** `components/client/priority-tasks.tsx` + `components/client/issue-detail-modal.tsx`

Shows all issues currently in the **UAT** state. These are issues that have been built, passed internal QA, and are now ready for the client to test and sign off on.

Same interaction model as the Business Review card — clicking an issue opens the modal where the client can record UAT test results in the Tests tab.

Issues are also sorted by question count descending.

---

## Opening the chat from a card

Each issue card has a small chat icon button (visible on hover). Clicking it navigates to the chat page and opens a new conversation pre-titled with the issue identifier and name. The routing logic strips the last segment of the current URL and replaces it with `/chat`:

```
/acme/dashboard  →  /acme/chat?newChat=SPA-42%20Fix%20login%20bug
```

---

## Full data flow on page load

```
User lands on /{slug}/dashboard
          │
          ├── AuthGate checks Supabase session → if invalid, redirect to /
          │
          ├── Sidebar renders with role-based nav
          │
          ├── GET /issues?slug={slug}
          │     → allIssues populated
          │     → projects list extracted
          │     → businessReviewIssues filtered (state === "Business Review")
          │     → uatIssues filtered (state === "UAT")
          │
          ├── GET /decisions/counts?user_email={email}  (refetches every 30s)
          │     → questionCounts map populated
          │     → badge numbers shown on issue cards
          │
          └── GET /get-dora-metrics?linear_name={slug}
                → SDLC metrics card populated
```

---

## File Map

| File | Responsibility |
|---|---|
| `app/[slug]/(portal)/dashboard/page.tsx` | Main client dashboard page |
| `app/[slug]/(portal)/layout.tsx` | Shared layout — AuthGate, Sidebar, ConsentProvider |
| `components/sidebar.tsx` | Sidebar with role-based navigation and logout |
| `components/headerDashboard.tsx` | Sticky top header with title, subtitle, and mobile menu toggle |
| `components/client/progress-pie-chart.tsx` | Project Stats donut chart |
| `components/roadmap/software-kpis.tsx` | SDLC Metrics card |
| `supabase/functions/manual-metrics/` | `PATCH` endpoint for the 2 manually-entered SDLC metrics (Code Coverage, Sonar Quality Gate) |
| `components/client/priority-tasks.tsx` | Reusable issue list — used for both Business Review and Acceptance Testing |
| `components/client/issue-detail-modal.tsx` | Issue detail modal with Description / Chat / Tests / Decisions / Design / Demo tabs |
| `components/client/issue-cards.tsx` | Individual issue card and list row components |
| `components/client/request-project-dialog.tsx` | "New project Request" dialog — emails admins instead of creating in Linear |
| `supabase/functions/project-requests/createProjectRequest.ts` | Looks up `role === "admin"` users and triggers the notification email |
| `supabase/functions/project-requests/sendProjectRequestMail.ts` | Resend email template for project requests |
| `context/UserContext.tsx` | Provides `profile` (role, email, id, linear_slug) |
| `context/CustomerSlugContext.tsx` | Provides the active customer slug when admin/dev is previewing a customer |
