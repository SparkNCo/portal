# Developer Dashboard — Flows & How It Works

> Reference for the developer-facing dashboard and everything it renders.  
> Main page: `app/dev/developer/page.tsx` → `DevDeveloperPage`, a thin client-side wrapper that renders `DeveloperDashboard` (the actual implementation lives in `app/[slug]/(portal)/developer/page.tsx`, re-exported here rather than duplicated).

---

## Who sees this dashboard

The developer dashboard is the landing page for users with `role === "developer"` after login, at the fixed route **`/dev/developer`** — no customer slug in the URL. Unlike customers/stakeholders, a developer isn't tied to one customer (they can be assigned to several at once — see below), so their own pages live under the slug-less `/dev/*` route tree rather than `/{slug}/*`.

> **Routing history:** this used to be `/{clientName}/developer`, slug-based off the first assignment's `clientName`. That's why the underlying component still physically lives at `app/[slug]/(portal)/developer/page.tsx` — `app/dev/developer/page.tsx` just re-exports it under the new slug-less path. See `app/docs/LOGIN_FLOWS.md` for the redirect-history note and `app/docs/CHAT_FLOWS.md` for the equivalent change on the Chat page (`/dev/chat`).

---

## Key difference from the Client Dashboard

A developer can be **assigned to multiple customers at once**. The developer dashboard is designed around that — it merges issues from all assigned customers into a single view, with a project filter to switch between them. The client dashboard, by contrast, always shows a single customer's data.

---

## Data loaded on mount

Two queries fire when the page mounts:

### 1. Issues — parallel `GET /issues?slug={clientName}` per assignment

The developer's assignments come from `profile.assignment_id[]`, each containing a `clientName` and optionally a `linear_slug`.

For every assigned customer, a separate `fetchIssues(clientName)` call is made **in parallel** using `Promise.all`. Each issue is tagged with a `_project` field (the `clientName`) so the project filter knows which customer it belongs to.

Once all results are back, they are merged into a single flat array called `allIssues`.

> If the developer has no assignments yet, `projects` is empty, the query is disabled, and an empty list is shown.

### 2. Decision counts — `GET /decisions/counts?user_email={email}`

Same as the client dashboard: fetches the number of unanswered decisions per issue for the logged-in developer. Powers the yellow badge on issue cards.

**Refetches automatically every 30 seconds.**

---

## Policy Approval Modal

When the dashboard loads, it checks whether the developer has agreed to the company policies via `GET /agreePolicies/check?user_id={id}`. If the response returns `approved: false`, a **blocking modal** appears immediately over the dashboard.

The modal cannot be dismissed — the developer must agree before they can use the portal.

- A **"View Policies"** button opens the Notion policies document in a new tab.
- An **"I Agree"** button calls `POST /agreePolicies/approve` with `{ userId, notionUrl }`.
- On success, the modal closes and the `policies-status` query is invalidated so the check won't trigger again on future visits.

**Source:** `components/ui/PolicyApprovalModal.tsx`

---

## Issue list pre-processing

Before being displayed, `allIssues` goes through three transformations in order:

1. **Filter out Done** — issues in `Done` state are removed. The developer's view only shows active work.
2. **Sort by question count** — issues with the most unanswered decisions appear at the top (so nothing falls through the cracks).
3. **Apply project filter** — if a specific customer is selected, only that customer's issues are shown.
4. **Apply status filter** — if specific statuses are selected via the filter panel, only those are shown.
5. **Apply sort order** — the final list is re-sorted by the selected sort option (see below).

---

## Controls

### Project filter (shown only when assigned to 2+ customers)

When a developer is assigned to more than one customer, a row of project filter buttons appears above the issue list:

- **All Projects** — clears the filter and shows every issue from all customers combined.
- **Per-customer buttons** — one button per customer (`clientName`). Selecting one shows only that customer's issues.

If a developer only has one assignment, these buttons are hidden entirely.

### Sort controls

Two sort modes, always visible:

| Mode | Behavior |
|---|---|
| **Last Updated** *(default)* | Sorts issues by `updatedAt` descending — most recently changed issues first |
| **Priority** | Sorts by `Urgent → High → Medium → Low → No priority` |

### Status filter

Built into the `PriorityTasks` component via `filterState`. A filter panel (accessible from the issue list header) lists every status present in the current issues. Statuses can be toggled on/off to narrow the list. "Clear all filters" resets them.

The available statuses are derived dynamically from the actual issues — only statuses that exist in the current data are shown.

---

## Dashboard Sections

The page is divided into two rows:

### Row 1 — Quick Links & Tool Shortcuts (2-column grid)

#### Quick Links — `QuickLinks`

**Source:** `components/developer/quick-links.tsx`

A card with direct links to three Airtable forms that developers use regularly:

| Link | Purpose |
|---|---|
| **Daily Tracker** | Airtable form for logging daily work activity |
| **PTO Request** | Form for submitting paid time off requests |
| **Client Escalation** | Form to escalate client issues or blockers to management |

Each link opens in a new tab. The card renders whatever links are configured in the `links` array — adding or removing links only requires editing that file.

#### Tool Shortcuts — `ToolShortcuts`

**Source:** `components/developer/tool-shortcuts.tsx`

A card with icon buttons for the three tools the team uses:

| Tool | Purpose |
|---|---|
| **JumpCloud** | Identity and access management (SSO, device management) |
| **PostHog** | Product analytics and session recording |
| **GitHub** | Code repository and pull request management |

> All three currently link to `#` (placeholder). The actual URLs should be configured in the `tools` array inside `tool-shortcuts.tsx`.

### Row 2 — All Tasks (full width)

**Source:** `components/client/priority-tasks.tsx`

The main content area shows all active issues (non-Done) across the developer's assigned customers as a scrollable card grid. It uses the same `PriorityTasks` component as the client dashboard, but with full filter and sort controls enabled.

The card title changes dynamically:
- `"All Tasks"` when no project filter is active
- The customer's `clientName` when a specific project is selected

Clicking any issue card opens the **Issue Detail Modal** with up to six tabs: Description, Chat, Tests, Decisions, Design, and Demo (Design and Demo are hidden for Bug issues). See `app/docs/FEATURES_FLOWS.md` for the full interaction flows inside the modal.

> **Note:** The `CreateIssue` button is currently commented out at the bottom of the page. It would allow developers to create new issues directly from their dashboard.

---

## Full data flow on page load

```
User lands on /dev/developer
          │
          ├── AuthGate checks Supabase session → if invalid, redirect to /
          │
          ├── Sidebar renders with developer nav (Developer, Chat, Documents)
          │
          ├── profile.assignment_id[] resolved
          │     → projects list built [ { clientName, slug }, ... ]
          │
          ├── Promise.all → GET /issues per customer (parallel)
          │     → each issue tagged with _project = clientName
          │     → results merged into allIssues
          │     → Done issues filtered out
          │     → sorted by question count descending
          │
          ├── GET /decisions/counts?user_email={email}  (refetches every 30s)
          │     → questionCounts map populated
          │     → badge numbers shown on issue cards
          │
          ├── GET /agreePolicies/check?user_id={id}
          │     → if approved: false → PolicyApprovalModal shown (blocking)
          │     → POST /agreePolicies/approve on "I Agree"
          │
          └── UI renders
                → project filter buttons (if 2+ customers)
                → sort controls
                → PriorityTasks with filterState wired up
```

---

## Filtering & sorting interaction

```
allIssues (merged, Done removed, sorted by question count)
          │
          ├── selectedProject filter
          │     → null  = show all
          │     → "acme" = show only issues where _project === "acme"
          │
          ├── selectedStatuses filter
          │     → []              = show all statuses
          │     → ["QA", "UAT"]   = show only matching statuses
          │
          └── sortBy
                → "updated"   = order by updatedAt DESC
                → "priority"  = order by Urgent > High > Medium > Low
```

---

## File Map

| File | Responsibility |
|---|---|
| `app/dev/developer/page.tsx` | Main entry point (`/dev/developer`) — re-exports `DeveloperDashboard` |
| `app/[slug]/(portal)/developer/page.tsx` | `DeveloperDashboard` implementation. Also still reused directly by `panel-renderer.tsx`'s `case "developer"`, for the older/dormant nested `/{devSlug}/dashboards/[customer]/[panel]` flow (its Sidebar nav entry is commented out, but the route and panel case still exist) |
| `app/dev/layout.tsx` | Layout for every `/dev/*` route — AuthGate, Sidebar, and an extra `role !== "developer"` redirect-home guard (since there's no slug to imply ownership here) |
| `app/[slug]/(portal)/layout.tsx` | Shared layout for slug-based routes — AuthGate, Sidebar, ConsentProvider |
| `app/[slug]/(portal)/dashboard/page.tsx` | Exports `fetchIssues` reused by the developer dashboard |
| `components/developer/quick-links.tsx` | Quick Links card with Airtable form links |
| `components/developer/tool-shortcuts.tsx` | Tool Shortcuts card (JumpCloud, PostHog, GitHub) |
| `components/client/priority-tasks.tsx` | Issue list with filter, sort, and search |
| `components/client/issue-detail-modal.tsx` | Issue detail modal — Description / Chat / Tests / Decisions / Design / Demo |
| `components/client/issue-cards.tsx` | Individual issue card and list row rendering |
| `components/ui/PolicyApprovalModal.tsx` | Blocking policy agreement modal shown on first access |
| `context/UserContext.tsx` | Provides `profile` including `assignment_id[]` |
