# Build & Bugs Pages — Flows & How They Work

> Reference for the two single-purpose issue list pages in the portal.  
> Build: `app/[slug]/dashboard/(portal)/build/page.tsx` → `BuildPage`  
> Bugs: `app/[slug]/dashboard/(portal)/bugs/page.tsx` → `BugsPage`

Both pages reuse the same data source (`fetchIssues` from the Client dashboard) and the same list component (`PriorityTasks`), but apply different filtering, sorting, and entry points on top.

---

## Who sees these pages

Both pages live inside the shared portal layout (`app/[slug]/dashboard/(portal)/layout.tsx`), so they're reachable by any authenticated role with a sidebar link to them. They resolve the active customer the same way as the rest of the dashboard:

1. `CustomerSlugContext` (admin/developer previewing a customer)
2. `urlSlug` from the URL params
3. `profile.linear_slug` from the user's profile

`linearSlug` (used by `CreateIssue`) falls back to `profile.assignment_id[].linear_slug` matched by `clientName` for non-customer roles.

---

## Data loaded on mount

Both pages run a single query:

```
GET /issues?slug={slug}
```

via `fetchIssues` (defined in `app/[slug]/dashboard/(portal)/client/page.tsx` and reused here). The full, unfiltered list is stored as `allIssues`.

- **Build page** shows all issues (no label filter).
- **Bugs page** filters `allIssues` down to issues that have a label named `"bug"` (case-insensitive) → `bugIssues`.

---

## Build Page

**Title:** "Build" — subtitle "Guide new features"

### Filters

| Filter | UI | Behavior |
|---|---|---|
| **Project** | Button row above the list (`All Projects` + one per project found in the issues) | Single-select. Filters `allIssues` by `issue.project.id` |
| **Status** | Dropdown chip group | Multi-select |
| **Labels** | Dropdown chip group | Multi-select — matches any of `issue.labels.nodes[].name` |
| **Priority** | Dropdown chip group | Multi-select — matches `issue.priorityLabel` |

Filters are applied in this order: project → status → labels → priority.

### Sort

A **"Sort by"** button row above the list, with two options:

| Option | Label | Logic |
|---|---|---|
| `updated` (default) | Last Updated | `updatedAt` descending |
| `estimate` | Estimate Value | `estimate` descending (issues with no estimate sort last) |

No priority tiering — this is a flat sort over the filtered list.

### Editing an issue

Clicking the edit action on an issue card opens `EditIssueModal` (`components/build/edit-issue-modal.tsx`), which lets you change **title**, **description**, and **priority**, then `PATCH /issues/edit`. On success the `linear-issues` query is invalidated so the list refreshes. Editing also flags the issue as recently updated — see [Recently Updated badge](#recently-updated-badge) below.

### Create entry point

`CreateIssue` (compact mode) with `defaultType="feature"`, labeled **"Request Feature"**.

---

## Bugs Page

**Title:** "Bugs" — subtitle "Tickets labeled as bugs"

### Filters

| Filter | UI | Behavior |
|---|---|---|
| **Project** | Button row above the list (`All Projects` + one per project found among bug-labeled issues) | Single-select |
| **Status** | Dropdown chip group | Multi-select |
| **Priority** | Dropdown chip group | Multi-select |
| **Date** | Dropdown date-range inputs (`from` / `to`) | Filters by `issue.createdAt`; the `to` date is inclusive (end of day) |

Filters are applied in this order: project → status → priority → date.

> Bugs has no Labels filter in its dropdown (the label filter is implicit — only `bug`-labeled issues are shown at all).

### Sort

Two-tier sort, designed so the list reads as a worklist (most urgent, oldest-first within a tier):

1. **Priority descending** — `Urgent (4) → High (3) → Medium (2) → Low (1) → none (0)`, via a local `PRIORITY_RANK` map.
2. Within the same priority, a **"Sort by"** button row (identical UI/labels to Build):
   - `updated` (default) — **Last Updated**, `updatedAt` descending
   - `estimate` — **Estimate Value**, `estimate` descending

### Create entry point

`CreateIssue` (compact mode) with `defaultType="bug"`, labeled **"Bug Report"**.

---

## Shared component: `PriorityTasks`

**Source:** `components/client/priority-tasks.tsx`

Both pages pass their filtered/sorted list into the same `PriorityTasks` component via `issuesData` + a `filterState` object (`components/client/issues.types.ts` → `FilterState`). The component owns:

- The **Filter** dropdown UI (Status / Priority / Labels / Date sections — each section only renders if its corresponding `available*` array / handler is passed in).
- A **title search box** (client-side substring match, independent of `filterState`).
- The **grid/list rendering** of issue cards, and the **Issue Detail Modal** on click.

Because `FilterState` fields are optional, each page only needs to supply the filters it actually uses — Build omits `dateFrom`/`dateTo`, Bugs omits `selectedLabels`/`availableLabels`.

---

## Recently Updated badge

A small **orange dot** appears on an issue card (top-right corner on the grid `IssueCard`, left of the branch tag on the compact `IssueListRow`) whenever someone has edited that ticket and nobody has opened it since. It's a single shared flag per issue — not tied to any one viewer.

**Backed by:** `portal.issue_updates` — one row per issue:

| Column | Notes |
|---|---|
| `issue_id` | Primary key |
| `updated_by` | Email of whoever made the edit |
| `updated_at` | When the edit happened |
| `seen` | `false` = badge shows, `true` = badge hidden |

**Write path (flips to unseen):**
1. Any role uses the Edit Ticket pencil → `EditIssueModal` (`components/build/edit-issue-modal.tsx`) sends `actorEmail: profile.email` along with the `PATCH /issues/edit` payload.
2. `handleUpdateIssue` (`supabase/functions/issues/updateIsste.ts`) calls `markIssueUpdated(issueId, actorEmail)` after the Linear update succeeds.
3. `markIssueUpdated` (`supabase/functions/utils/issueUpdates.ts`) upserts the row with `seen: false` (`on_conflict=issue_id`, so repeated edits just refresh the timestamp instead of duplicating rows).

**Read path (shows the badge):**
- `useIssueUpdateBadge()` (`components/client/use-issue-update-badge.ts`) runs one bulk Supabase read — `select issue_id, seen, updated_by from portal.issue_updates where seen = false` — and exposes `hasUnseenUpdate(issue, currentUserEmail)` and `isOwnUnseenUpdate(issue, currentUserEmail)`.
- `PriorityTasks` calls `hasUnseenUpdate(issue, profile?.email)` per issue and passes `hasUpdate` down to `IssueCard` / `IssueListRow` (`components/client/issue-cards.tsx`), which render the dot. The actor who made the edit never sees their own dot, since `hasUnseenUpdate` returns `false` when `updated_by` matches the current viewer.

**Clear path (flips back to seen):**
- Opening the full Issue Detail Modal (`components/client/issue-detail-modal.tsx`) fires `POST /issues/seen` → `handleMarkIssueSeen` → `markIssueSeen(issueId)`, which sets `seen: true` for that issue and invalidates the `issue-updates` query so the dot disappears immediately for everyone — **unless** the viewer opening it is the same person who made the edit (`isOwnUnseenUpdate`), in which case the request is skipped so the flag stays unseen for everyone else.

> Still **not** per-user in storage — one shared `seen` flag per issue — but the actor's own identity (`updated_by`) is used client-side to suppress both their badge and their ability to silently clear it for others.

---

## File Map

| File | Responsibility |
|---|---|
| `app/[slug]/dashboard/(portal)/build/page.tsx` | Build page — all issues, project/status/label/priority filters, updated/estimate sort |
| `app/[slug]/dashboard/(portal)/bugs/page.tsx` | Bugs page — bug-labeled issues only, project/status/priority/date filters, priority+updated/estimate sort |
| `app/[slug]/dashboard/(portal)/client/page.tsx` | Defines `fetchIssues`, reused by both pages |
| `components/client/priority-tasks.tsx` | Shared filter dropdown + issue list/grid rendering |
| `components/client/issues.types.ts` | `Issue` and `FilterState` shared types, `STATUS_ORDER` |
| `components/client/issue-cards.tsx` | `IssueCard` / `IssueListRow` |
| `components/build/edit-issue-modal.tsx` | Edit Title/Description/Priority modal (Build only); triggers the Recently Updated flag |
| `components/shared/create-issue.tsx` | Create Issue dialog (both pages, different `defaultType`/`label`) |
| `components/client/use-issue-update-badge.ts` | Reads `portal.issue_updates`, exposes `hasUnseenUpdate(issue)` |
| `supabase/functions/utils/issueUpdates.ts` | `markIssueUpdated()` / `markIssueSeen()` helpers for `portal.issue_updates` |
| `supabase/functions/issues/updateIsste.ts` | `handleUpdateIssue` (writes the update flag), `handleMarkIssueSeen` (clears it) |
