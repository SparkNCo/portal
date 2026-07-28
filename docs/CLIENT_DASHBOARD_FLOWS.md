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

### 2. DORA Metrics — `SoftwareKPIs`

**Source:** `components/roadmap/software-kpis.tsx`

Shows the four **DORA engineering metrics** for the customer's team, fetched from `GET /get-dora-metrics?linear_name={slug}`:

| Metric | What it measures |
|---|---|
| **Deploy Frequency** | Count of `feat/`/`fix/` merges whose squash commit is confirmed reachable on `main`. Shows last 30-day and 90-day counts |
| **Lead Time for Changes** | Average hours from branch creation to squash-merge, `feat/` branches only |
| **MTTR** (Mean Time to Restore) | Average hours from branch creation to squash-merge, `fix/` branches only — despite the classic DORA name, this is not "recovery from a production incident," it's the same lifecycle measurement as Lead Time, applied to fix branches |
| **Change Failure Rate** | % of non-hotfix deployments immediately followed by a hotfix deployment |

If no metrics are available yet, the card shows "No metrics available."

**None of these are derived from GitHub issues anymore.** Everything comes from Git branch and commit history in `supabase/functions/dora/`. Full pipeline diagram: `supabase/functions/dora/diagrams/dora-flow.mmd`.

**Calculation notes — Lead Time for Changes / MTTR:** a PR only counts if its **branch name** (not the PR title) starts with `feat/` (Lead Time) or `fix/` (MTTR) and contains a Linear id, e.g. `feat/SPA-123-add-login`. For each qualifying merged PR:
- **Dev start** (`branch_created_at`) — the branch-creation timestamp recorded in `portal.dora_branch_events`, captured by the `github-webhook` function (GitHub `create` event) or, when no webhook is registered, by `dora/events.ts` polling GitHub's events feed. If neither caught it, it falls back to the earliest commit date on the PR (`dev_start_source: "first_commit_fallback"` in the raw result).
- **Dev completion** — the merge timestamp, only counted once `isSquashMergeForPR` confirms the merge actually landed as a squash commit (a regular merge commit or rebase is excluded).
- The metric value is `dev_completed_at - branch_created_at` in hours, averaged across all matching branches.

See `supabase/functions/dora/lifecycle.ts` (shared by `leadTime.ts` and `mttr.ts`).

**Calculation notes — Deploy Frequency:** same `feat/`/`fix/` branch-name qualification as above, plus confirmation via GitHub's compare API that the squash commit is reachable on `main` (`isCommitOnMain`). There is no CI-status gate. See `supabase/functions/dora/deployFreq.ts`.

**Calculation notes — Change Failure Rate:** the only metric that still looks at **all** merged PRs (not just `feat/`/`fix/`) and at PR title/commits rather than branch name. A PR is treated as a "hotfix" when its title, labels, or commit messages start with `revert`, `hotfix`, `rollback`, `bugfix`, `fix/`, or `fix:` (or match `fix: SPA-<id>`). A non-hotfix deployment counts as "failed" if the next chronological deployment is a hotfix. See `supabase/functions/dora/cfr.ts` (`ERROR_SIGNALS`, `isHotfix` in `github.ts`) — unchanged by the Git-history migration.

**How `dora` is triggered:** not on its own schedule — it's called once per day, per customer, at the end of the `issueMetrics` cron job (`triggerDoraForAllCustomers()` in `supabase/functions/issueMetrics/index.ts`). Each run also polls GitHub's events feed for new branch-creation events before computing metrics. CFR is recomputed from scratch each run (sliding window over the last `limit` merged PRs). Lead Time, MTTR, and Deploy Frequency are cumulative: each run only looks at PRs merged in the last 24 hours and appends new entries (deduped by `pr_number`, never overwritten). A gap of more than 24 hours between cron runs causes PRs merged in that gap to be permanently missed from those three metrics (though they still appear in CFR's scan).

### 3. Business Review — `PriorityTasks` (Business Review)

**Source:** `components/client/priority-tasks.tsx` + `components/client/issue-detail-modal.tsx`

Shows all issues currently in the **Business Review** state. These are issues where the team has written the user stories and acceptance criteria and is waiting for the client to review and approve them before development starts.

Issues are sorted by question count — those with the most unanswered questions appear first.

Clicking any issue card opens the **Issue Detail Modal** with five tabs: Description, Chat, Tests, Decisions, and Design. See `app/docs/FEATURES_FLOWS.md` for the full interaction flows inside the modal.

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
                → DORA metrics card populated
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
| `components/roadmap/software-kpis.tsx` | DORA Metrics card |
| `components/client/priority-tasks.tsx` | Reusable issue list — used for both Business Review and Acceptance Testing |
| `components/client/issue-detail-modal.tsx` | Issue detail modal with Description / Chat / Tests / Decisions / Design tabs |
| `components/client/issue-cards.tsx` | Individual issue card and list row components |
| `components/client/request-project-dialog.tsx` | "New project Request" dialog — emails admins instead of creating in Linear |
| `supabase/functions/project-requests/createProjectRequest.ts` | Looks up `role === "admin"` users and triggers the notification email |
| `supabase/functions/project-requests/sendProjectRequestMail.ts` | Resend email template for project requests |
| `context/UserContext.tsx` | Provides `profile` (role, email, id, linear_slug) |
| `context/CustomerSlugContext.tsx` | Provides the active customer slug when admin/dev is previewing a customer |
