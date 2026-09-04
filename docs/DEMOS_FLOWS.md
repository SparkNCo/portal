# Demos — Flows & How It Works

> Reference for the developer-only "Demos" sidebar tab. For the per-ticket Demo tab itself (versions, playback, feedback), see `app/docs/FEATURES_FLOWS.md` section 7 — this page is a project-wide lens on top of the same `portal.demo_videos` data, not a separate feature.

---

## Who sees this page

Developer-only, at the fixed route **`/dev/demos`** (`app/dev/demos/page.tsx`). Added to the sidebar (`components/sidebar.tsx` → `developerNavItems`) alongside Build/Bugs. There is no customer/admin/stakeholder equivalent — unlike Build/Bugs/Documents/Chat, this page has no dual-purpose `app/[slug]/(portal)/...` implementation to re-export; it lives directly under `app/dev/`.

Like every other developer page, it's scoped to **whichever project is selected in the sidebar dropdown** (`lib/selected-project-context.tsx`, `useSelectedProject()`), falling back to the developer's first assignment if nothing's been picked yet.

---

## The problem it solves

`portal.demo_videos` rows are versioned **per issue** — there's no table that answers "what demos exist for this project" on its own, and no way to attach one uploaded video to several tickets without re-uploading it. This page adds both:

1. A **project-wide list** of every ticket that has at least one demo attached.
2. An **upload flow** that uploads/links a video once and attaches it to as many features/bugs as you pick in one go.

---

## Data loaded on mount

`fetchProjectDemos(slug)` (`lib/demo-video-utils.ts`) does two things in sequence:

1. `fetchIssues(slug)` — the exact same call Build/Bugs/Developer use — to get every issue in the project (up to Linear's `first: 100` cap per request; **no pagination**, so a project with more than 100 issues can have older/excess tickets fall outside this list, and any demo attached to one of them silently won't show up here — a pre-existing limitation shared with Build/Bugs/Developer, not specific to this page).
2. `GET /demo-videos?issue_ids={id1,id2,...}` (`listDemoVideosByIssueIds`) — every `demo_videos` row across those issue ids, in one query, no per-issue round trip.

The page then filters the full issue list down to `issuesWithDemos` — only tickets that appear as an `issue_id` on at least one returned demo row.

---

## Listing — reuses the developer dashboard's own components

`issuesWithDemos` is rendered with the **same `PriorityTasks`/`IssueCard` components** the developer dashboard, Build, and Bugs pages use (`components/client/priority-tasks.tsx`) — not a bespoke video-grid. This was a deliberate simplification over an earlier version of this page that rendered its own grid of video-preview cards grouped by shared content; that got replaced because it duplicated filter/search/pagination logic `PriorityTasks` already has, and its "linked tickets" badges didn't fit the card cleanly.

That means this page gets, for free:

- **Search** by ticket title or code (`getIssueCode`).
- The **Filter** popover (status/label/priority).
- The scrollable, capped list with a **"View all"** expand toggle — the built-in answer to "too many demos loading at once," rather than a separate page-size limit.

Clicking a card opens the same **Issue Detail Modal** as everywhere else — except it's told to open straight on the **Demo tab** via a new `initialTab` prop (`IssueDetailModal`) / `initialModalTab` prop (`PriorityTasks`), since that's the entire reason this page linked to the ticket. Versions stay grouped per-ticket exactly like they do from any other entry point into the modal.

The pencil/edit affordance works the same as elsewhere too — `onEditIssue` opens `EditIssueModal`, and saving invalidates the `["project-demos", slug]` query.

---

## Uploading — one upload, many tickets

The **"Upload Demo"** button reveals an inline form (`UploadDemoForm`, in `app/dev/demos/page.tsx`):

1. Pick a mode: **Upload file** (`accept="video/*,image/*"`) or **Video link** (embed URL, e.g. Loom).
2. **"Related features & bugs"** — a searchable, checkbox list of every issue in the project. Pick as many as apply.
3. **Upload** — the file/link is sent **once**, to the *first* selected ticket, via the normal create-version call (`POST /demo-videos`, same as the Demo tab's own "Upload Media"/"Add Link"). For every *other* selected ticket, a follow-up `POST /demo-videos` is sent with `source_demo_id` set to the first demo's id instead of `file`/`embed_url` — which attaches the same underlying video as a new version there, with no re-upload. See `app/docs/FEATURES_FLOWS.md` §7c for how that endpoint works server-side.

If 5 tickets are selected, this means 1 upload + 4 lightweight "attach" calls, run sequentially (not in parallel, to avoid racing the same-issue version-number check on the very first call and to keep error messages attributable to a specific ticket).

On success, the `["project-demos", slug]` query is invalidated so both the upload form's ticket list and the issue list below refresh.

---

## Empty states

| Condition | What's shown |
|---|---|
| Developer has no assignments yet | "No assigned projects yet" |
| Project has issues but none have a demo attached | "No demos uploaded yet for this project." |
| A search/filter in `PriorityTasks` matches nothing | `PriorityTasks`'s own "No issues match the current filters." |

---

## File Map

| File | Responsibility |
|---|---|
| `app/dev/demos/page.tsx` | The page itself — fetches project issues + demos, filters to `issuesWithDemos`, renders `PriorityTasks`, and owns the `UploadDemoForm` |
| `lib/demo-video-utils.ts` | `fetchProjectDemos` (issues + demos for a project), `groupDemosByContent`/`DemoGroup` (dedupe by actual content, used by `DemoPicker`), shared `Demo`/`DemoUser` types and display helpers |
| `components/client/priority-tasks.tsx` | Issue list — search, filter, sort, and the `initialModalTab` passthrough to `IssueDetailModal` |
| `components/client/issue-cards.tsx` | `IssueCard`/`IssueListRow` — same cards as every other issue list in the app |
| `components/client/issue-detail-modal.tsx` | `IssueDetailModal` — accepts `initialTab` to open straight on a given tab (here, `"demo"`) |
| `components/build/edit-issue-modal.tsx` | Quick-edit modal opened from a card's pencil icon |
| `components/sidebar.tsx` | `developerNavItems` — adds the "Demos" tab |
| `lib/selected-project-context.tsx` | Source of the sidebar-selected project this page (and every other developer page) is scoped to |
| `supabase/functions/demo-videos/` | Backend — see `app/docs/FEATURES_FLOWS.md` §7's API table and File Map for the full endpoint list |
