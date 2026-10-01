# Demos — Flows & How It Works

> Reference for the "Demos" sidebar page. For the per-ticket Demo tab itself (versions, playback, feedback), see `app/docs/FEATURES_FLOWS.md` section 7 — this page is a project-wide lens on top of the same `portal.demo_videos` data, not a separate feature.

---

## Who sees this page

Every role, at **`/{slug}/demos`** (`app/[slug]/(portal)/demos/page.tsx`), scoped to the initiative in the URL. It's in the sidebar for all four roles (`components/sidebar.tsx`):

| Role | How they get there |
|---|---|
| Customer / Stakeholder | "Demos" in their menu, under their own `/{slug}` |
| Admin | "Demos" among the customer pages, once an initiative is picked in the Initiative dropdown |
| Developer | "Demos" links to `/{selected project}/demos` (the project chosen in "Working on"). Switching project while on the page keeps them on Demos for the new one; landing on a `/{slug}/demos` link selects that project in the dropdown. |

The old **`/dev/demos`** route only redirects to the developer's selected project's `/{slug}/demos` (or shows "No assigned projects yet" if they have none).

**What each role can do:**

| Action | Customer | Stakeholder | Developer | Admin |
|---|---|---|---|---|
| View demos and preview links | ✓ | ✓ | ✓ | ✓ |
| Comment on a version (ticket's Demo tab) | ✓ | ✓ | ✓ | ✓ |
| "Upload Demo" on this page | | | ✓ | ✓ |
| Create / Update Version in a ticket's Demo tab (upload, link, attach existing) | | | ✓ | ✓ |

The upload and version controls are hidden for customers and stakeholders, and `demo-videos` rejects create/replace requests from them with a 403 (`canManageDemos` in `supabase/functions/demo-videos/helpers.ts`). That check looks the role up from the request's `email`, so it guards the portal's own UI rather than replacing real caller authentication.

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

## Listing

The page shows a grid with **one card per distinct demo** (`DemoCard`), not one per `demo_videos` row: `groupDemosByContent` collapses rows that point at the same file or link (the same video attached to several tickets) into one card, listing every ticket it's attached to.

- **Search** by demo title, demo id, or ticket code.
- Clicking a card opens the **Issue Detail Modal** for the first linked ticket, straight on the **Demo tab** (`initialTab="demo"`).
- The modal's edit action opens `EditIssueModal` (for tickets not in Done); saving invalidates the `["project-demos", slug]` query.

---

## Uploading — one upload, many tickets

The **"Upload Demo"** button (developers and admins only) reveals an inline form (`UploadDemoForm`, in `app/[slug]/(portal)/demos/page.tsx`):

1. Pick a mode: **Upload file** (`accept="video/*,image/*"`) or **Video link** (embed URL, e.g. Loom).
2. **"Related features & bugs"** — a searchable, checkbox list of every issue in the project. Pick as many as apply.
3. **Upload** — the file/link is sent **once**, to the *first* selected ticket, via the normal create-version call (`POST /demo-videos`, same as the Demo tab's own "Upload Media"/"Add Link"). For every *other* selected ticket, a follow-up `POST /demo-videos` is sent with `source_demo_id` set to the first demo's id instead of `file`/`embed_url` — which attaches the same underlying video as a new version there, with no re-upload. See `app/docs/FEATURES_FLOWS.md` §7c for how that endpoint works server-side.

If 5 tickets are selected, this means 1 upload + 4 lightweight "attach" calls, run sequentially (not in parallel, to avoid racing the same-issue version-number check on the very first call and to keep error messages attributable to a specific ticket).

On success, the `["project-demos", slug]` query is invalidated so both the upload form's ticket list and the issue list below refresh.

---

## Preview Links banner

Above the issue list, `PreviewLinksBanner` (`components/client/preview-links-banner.tsx`) shows the selected project's Preview Links ("Test Environments") — the same banner that appears at the top of every one of that project's tickets' Demo tab (see `app/docs/FEATURES_FLOWS.md` §7 and `app/docs/ADMIN_FLOWS.md` → Customer Profile). Each link renders as `{text}: {url}`, both parts clickable. Still settable from Admin → Users → that customer's **Profile**, but admins and developers can also add/edit/remove links inline from this banner itself (a small "Edit"/"Add" affordance next to the list) — saves through the same `PATCH /users?type=customer` endpoint. Customers/stakeholders only ever see the read-only list; the banner renders nothing for them when there are none.

---

## Empty states

| Condition | What's shown |
|---|---|
| No initiative in the URL | "No initiative selected" |
| Developer opens `/dev/demos` with no assignments | "No assigned projects yet" |
| Project has issues but none have a demo attached | "No demos uploaded yet for this project." (plus "Upload Demo" for developers/admins) |
| The search matches nothing | "No demos match "{search}"." |

---

## File Map

| File | Responsibility |
|---|---|
| `app/[slug]/(portal)/demos/page.tsx` | The page itself — fetches project issues + demos, groups them into `DemoCard`s, owns the `UploadDemoForm`, and hides upload for customers/stakeholders |
| `app/dev/demos/page.tsx` | Redirect from the old developer-only route to `/{slug}/demos` (`components/dev-route-redirect.tsx`) |
| `components/client/demo-tab.tsx` | The ticket's Demo tab — Create/Update Version are hidden for customers/stakeholders |
| `lib/demo-video-utils.ts` | `fetchProjectDemos` (issues + demos for a project), `fetchPreviewLinks`, `groupDemosByContent`/`DemoGroup` (dedupe by actual content, used by `DemoPicker`), shared `Demo`/`DemoUser` types and display helpers |
| `components/client/preview-links-banner.tsx` | `PreviewLinksBanner` — the customer's admin-set Preview Links, shown at the top of this page |
| `components/client/issue-detail-modal.tsx` | `IssueDetailModal` — accepts `initialTab` to open straight on a given tab (here, `"demo"`) |
| `components/build/edit-issue-modal.tsx` | Quick-edit modal opened from a card's pencil icon |
| `components/sidebar.tsx` | "Demos" in every role's menu; the developer link and project switch for `/{slug}/demos` |
| `lib/selected-project-context.tsx` | The developer's selected project, used for their Demos link and the `/dev/demos` redirect |
| `supabase/functions/demo-videos/` | Backend — `canManageDemos` (helpers.ts) gates create/replace; see `app/docs/FEATURES_FLOWS.md` §7 for the full endpoint list |
