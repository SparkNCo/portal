# Client Dashboard — Flows & How It Works

> Reference for the client-facing dashboard and everything it renders.  
> Main page: `app/[slug]/dashboard/(portal)/client/page.tsx` → `ClientDashboard`

---

## Who sees this dashboard

The client dashboard is the landing page for users with `role === "customer"` or `role === "stakeholder"` after login. Both roles see the same page and the same data.

The URL follows the pattern `/{clientName}/dashboard/client`, where `clientName` is the slug stored on the user's profile (e.g. `/acme/dashboard/client`).

---

## Layout & Navigation

Every page inside the portal (client, developer, admin, roadmap, etc.) shares the same shell defined in `app/[slug]/dashboard/(portal)/layout.tsx`. That layout wraps all content with three things:

- **AuthGate** — checks that a valid Supabase session exists. If not, redirects to `/`.
- **Sidebar** — the left navigation panel (60px wide on desktop, slide-in drawer on mobile).
- **ConsentProvider** — handles PostHog analytics consent.

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

When `ClientDashboard` mounts, three separate queries fire:

### 1. Issues — `GET /issues?slug={slug}&ticket_statuses={...}`

Fetches all issues belonging to the customer's Linear workspace identified by `slug`. The slug is resolved in this order of priority:
1. `CustomerSlugContext` (set when an admin or developer is previewing a customer's dashboard)
2. `urlSlug` from the URL params
3. `profile.linear_slug` from the user's profile

The full list of issues is stored as `allIssues` and used by all four dashboard cards.

### 2. Decision counts — `GET /decisions/counts?user_email={email}`

Fetches the number of **unanswered questions** per issue for the logged-in user. This powers the yellow badge shown on issue cards when a developer has asked a question that hasn't been answered yet.

This query **refetches automatically every 30 seconds** so the badges stay up to date without a manual refresh.

## Project filter

At the top of the dashboard there is a row of **project filter buttons** — one for "All" and one per unique project found across the issues list (extracted from `issue.project.id / issue.project.name`).

- Clicking a project button toggles it on/off. Multiple projects can be selected at once.
- Clicking **All** clears the filter and shows every issue.
- The filter is local state only — no API call is made when switching.
- When a filter is active, all four dashboard cards only show issues that belong to the selected project(s).

---

## Create Issue button

To the right of the project filters sits the **Create Issue** button (`components/shared/create-issue.tsx`), rendered in `compact` mode. It opens the issue creation dialog. See `docs/FLOWS.md` for the full issue creation flow.

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
| **Deploy Frequency** | How often code is deployed. Shows last 30-day and 90-day deployment counts |
| **Lead Time for Changes** | Average time from code commit to production deployment |
| **MTTR** (Mean Time to Restore) | Average time to recover from a production incident |
| **Change Failure Rate** | Percentage of deployments that caused a failure. Shows failed vs total deployments and the repo name |

If no metrics are available yet, the card shows "No metrics available."

### 3. Product Decisions — `PriorityTasks` (Business Review)

**Source:** `components/client/priority-tasks.tsx` + `components/client/issue-detail-modal.tsx`

Shows all issues currently in the **Business Review** state. These are issues where the team has written the user stories and acceptance criteria and is waiting for the client to review and approve them before development starts.

Issues are sorted by question count — those with the most unanswered questions appear first.

Clicking any issue card opens the **Issue Detail Modal** with four tabs: Description, Chat, Tests, and Decisions. See `docs/FLOWS.md` for the full interaction flows inside the modal.

The **chat icon** on each card navigates to the Chat page with that issue pre-selected (via `?newChat=...` query param).

### 4. Acceptance Testing — `PriorityTasks` (UAT)

**Source:** `components/client/priority-tasks.tsx` + `components/client/issue-detail-modal.tsx`

Shows all issues currently in the **UAT** state. These are issues that have been built, passed internal QA, and are now ready for the client to test and sign off on.

Same interaction model as the Product Decisions card — clicking an issue opens the modal where the client can record UAT test results in the Tests tab.

Issues are also sorted by question count descending.

---

## Opening the chat from a card

Each issue card has a small chat icon button (visible on hover). Clicking it navigates to the chat page and opens a new conversation pre-titled with the issue identifier and name. The routing logic strips the last segment of the current URL and replaces it with `/chat`:

```
/acme/dashboard/client  →  /acme/dashboard/chat?newChat=SPA-42%20Fix%20login%20bug
```

---

## Full data flow on page load

```
User lands on /{slug}/dashboard/client
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
| `app/[slug]/dashboard/(portal)/client/page.tsx` | Main client dashboard page |
| `app/[slug]/dashboard/(portal)/layout.tsx` | Shared layout — AuthGate, Sidebar, ConsentProvider |
| `components/sidebar.tsx` | Sidebar with role-based navigation and logout |
| `components/headerDashboard.tsx` | Sticky top header with title, subtitle, and mobile menu toggle |
| `components/client/progress-pie-chart.tsx` | Project Stats donut chart |
| `components/roadmap/software-kpis.tsx` | DORA Metrics card |
| `components/client/priority-tasks.tsx` | Reusable issue list — used for both Product Decisions and Acceptance Testing |
| `components/client/issue-detail-modal.tsx` | Issue detail modal with Description / Chat / Tests / Decisions tabs |
| `components/client/issue-cards.tsx` | Individual issue card and list row components |
| `components/shared/create-issue.tsx` | Create Issue dialog |
| `components/ui/PolicyApprovalModal.tsx` | Developer policy agreement modal |
| `context/UserContext.tsx` | Provides `profile` (role, email, id, linear_slug) |
| `context/CustomerSlugContext.tsx` | Provides the active customer slug when admin/dev is previewing a customer |
