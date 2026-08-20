# Build & Bugs Pages — Flows & How They Work

> Reference for the two single-purpose issue list pages in the portal.  
> Build: `app/[slug]/(portal)/build/page.tsx` → `BuildPage`  
> Bugs: `app/[slug]/(portal)/bugs/page.tsx` → `BugsPage`

Both pages reuse the same data source (`fetchIssues` from the Client dashboard) and the same list component (`PriorityTasks`), but apply different filtering, sorting, and entry points on top.

---

## Who sees these pages

Both pages live inside the shared portal layout (`app/[slug]/(portal)/layout.tsx`), so they're reachable by any authenticated role with a sidebar link to them. They resolve the active customer the same way as the rest of the dashboard:

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

via `fetchIssues` (defined in `app/[slug]/(portal)/dashboard/page.tsx` and reused here). The full, unfiltered list is stored as `allIssues`.

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

A small **orange message-icon badge** appears on an issue card (top-right corner on the grid `IssueCard`, left of the branch tag on the compact `IssueListRow`) whenever the issue changed — an edit, a new/answered Decision, a new Test, a Design resource, or a Demo video/comment — since *that specific viewer* last opened it. Each member of the initiative gets their own read state; one person opening the issue does not clear it for anyone else.

**Backed by two tables:**

`portal.issue_updates` — one row per issue, the latest change:

| Column | Notes |
|---|---|
| `issue_id` | Primary key |
| `updated_by` | Email of whoever made the change |
| `updated_at` | When the change happened |
| `seen` | Unused — superseded by `portal.issue_views` below |

`portal.issue_views` — one row per (issue, viewer):

| Column | Notes |
|---|---|
| `issue_id` / `user_id` | Composite primary key |
| `viewed_at` | When this user last opened the issue |

**Write path (produces an update):** every create/answer handler across the four panels — plus the Edit Ticket flow — calls `markIssueUpdated(issueId, actorEmail)` (`supabase/functions/utils/issueUpdates.ts`) after its insert succeeds, upserting the `issue_updates` row (`on_conflict=issue_id`, so repeated changes just refresh the timestamp): `handleUpdateIssue`, `handleAddComment`, `handleSetDecision` (`supabase/functions/issues/updateIsste.ts`), `handleCreateTest` (`supabase/functions/tests/index.ts`), `createDesignResource` (`supabase/functions/design-resources/createDesignResource.ts`), `createDemoVideoFromUpload`/`createDemoVideoFromEmbed`/`createComment` (`supabase/functions/demo-videos/`).

**Read path (shows the badge):**
- `useIssueUpdateBadge()` (`components/client/use-issue-update-badge.ts`) reads all of `issue_updates` plus the current user's own rows from `issue_views` (`eq("user_id", profile.id)`), and exposes `hasUnseenUpdate(issue, currentUserEmail)` / `isOwnUnseenUpdate(issue, currentUserEmail)`. An issue is unseen for a viewer when its latest `updated_at` is newer than that viewer's `viewed_at` (or they have no view row at all) and they weren't the one who made the change.
- `PriorityTasks` calls `hasUnseenUpdate(issue, profile?.email)` per issue and passes `hasUpdate` down to `IssueCard` / `IssueListRow` (`components/client/issue-cards.tsx`), which render the badge. The actor who made the change never sees their own badge.

**Clear path (marks viewed for that user only):**
- Opening the full Issue Detail Modal (`components/client/issue-detail-modal.tsx`) fires `POST /issues/seen` with `{ issueId, userId: profile.id }` → `handleMarkIssueSeen` → `markIssueViewed(issueId, userId)`, which upserts *that user's* `issue_views` row and invalidates their `["issue-views", profile.id]` query — the badge disappears only for them. Skipped when the viewer is the author of the latest change (`isOwnUnseenUpdate`), since they never had a badge to clear.

---

## File Map

| File | Responsibility |
|---|---|
| `app/[slug]/(portal)/build/page.tsx` | Build page — all issues, project/status/label/priority filters, updated/estimate sort |
| `app/[slug]/(portal)/bugs/page.tsx` | Bugs page — bug-labeled issues only, project/status/priority/date filters, priority+updated/estimate sort |
| `app/[slug]/(portal)/dashboard/page.tsx` | Defines `fetchIssues`, reused by both pages |
| `components/client/priority-tasks.tsx` | Shared filter dropdown + issue list/grid rendering |
| `components/client/issues.types.ts` | `Issue` and `FilterState` shared types, `STATUS_ORDER` |
| `components/client/issue-cards.tsx` | `IssueCard` / `IssueListRow` |
| `components/build/edit-issue-modal.tsx` | Edit Title/Description/Priority modal (Build only); triggers the Recently Updated flag |
| `components/shared/create-issue.tsx` | Create Issue dialog (both pages, different `defaultType`/`label`) |
| `components/client/use-issue-update-badge.ts` | Reads `portal.issue_updates` + `portal.issue_views`, exposes `hasUnseenUpdate(issue)` per viewer |
| `supabase/functions/utils/issueUpdates.ts` | `markIssueUpdated()` (writes `issue_updates`) / `markIssueViewed()` (writes `issue_views`) |
| `supabase/functions/issues/updateIsste.ts` | `handleUpdateIssue`, `handleAddComment`, `handleSetDecision` (write the update flag), `handleMarkIssueSeen` (clears it per-user) |
