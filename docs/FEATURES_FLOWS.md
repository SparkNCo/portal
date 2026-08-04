# Portal Flows

Reference for how the main customer-developer collaboration flows work end to end.

---

## Roles

| Role | What they can do |
|---|---|
| `customer` | Approve tests, submit decisions, record UAT results, complete Business Review, record UAT outcome (Approved/Fixes Required), **create Linear projects** |
| `stakeholder` | Same as `customer`, plus reopening a `Done` issue back to `Development` |
| `developer` / `admin` | Create issues, ask questions, create test cases |

These permissions are derived from `profile.role` (UserContext) and evaluated as `canAnswer` (customer/stakeholder) and `canAsk` (developer/admin) inside `IssueDetailModal`.

---

## 1. Create a Feature Request

**Entry point:** "Create Issue" button — `components/shared/create-issue.tsx`

1. User clicks **Create Issue**.
2. A type-picker dialog appears. User selects **Feature Request**.
3. The form asks for:
   - **Title** — required
   - **Description** — plain-language explanation of the feature
   - **Requirements** *(optional)* — what success looks like
   - **Project** *(optional)* — links the issue to a Linear project
   - **Priority** — Low / Medium / High / Urgent (default: Medium)
4. User clicks **Submit Issue**.
5. `POST /issues/create` is called with `{ title, description, priority, slug, projectId? }`.
6. The issue is created in Linear and returns an identifier (e.g. `SPA-42`).
7. A success toast shows the identifier. The dialog closes and resets.

> The same flow applies to **Bug Report** and **UAT Test Case** types — only the form fields differ. **Milestone** goes through a separate `POST /issues/milestone` endpoint and requires a project to be selected first. **Project** goes through its own `POST /issues/project` endpoint — see section below.

**How the Project dropdown gets populated:** `CreateIssue` calls `GET /issues/projects?slug={slug}`, which reads the `linear_projects` array from `portal.customers` and fetches their names from Linear. This means the dropdown always reflects `customers.linear_projects` as the source of truth — including any projects created via the portal.

`profile.linear_slug` is only set directly on the profile for `role: "customer"` users (their `users.customer_id` points to a `customers` row, which has `linear_slug`). Stakeholders/developers don't have it at the top level — their customer associations live in `profile.assignment_id[].linear_slug`, keyed by `clientName`. Pages rendering `CreateIssue` for non-customer roles (e.g. `app/[slug]/(portal)/dashboard/page.tsx`) must compute `linearSlug` by matching `profile.assignment_id[].clientName` against the currently selected customer slug and pass it as the `linearSlug` prop — otherwise the Project dropdown stays empty for stakeholders.

---

## 1b. New Project Request *(Client Dashboard)*

**Entry point:** "New project Request" button — `components/client/request-project-dialog.tsx` — rendered next to the project filters on the Client Dashboard (`app/[slug]/(portal)/dashboard/page.tsx`).

Unlike Bug/Feature/UAT, this does **not** create anything in Linear. It notifies the agency's admins by email so they can scope and create the project manually.

1. User clicks **New project Request**.
2. A dialog opens with an info banner ("Tell us about your idea and we'll email our team the details…") and a form:
   - **Title** — required
   - **Description** *(optional)* — rich text editor (`RichTextEditor`, same component used for Feature Request descriptions)
3. User clicks **Send Request**.
4. `POST /project-requests` is called with `{ title, description?, requestedBy, slug }`.
5. Backend (`supabase/functions/project-requests/createProjectRequest.ts`) queries `portal.users` for every row with `role === "admin"` and emails each one via Resend (`sendProjectRequestMail.ts`) with the title, description, requester email, and client slug.
6. A success toast confirms the request was sent; the dialog closes and resets.

**API endpoint:** `POST /project-requests`

| Field | Required | Notes |
|---|---|---|
| `title` | ✅ Yes | Project idea title |
| `description` | No | Rich-text/markdown description |
| `requestedBy` | No | Email of the requesting user |
| `slug` | No | Customer slug, included in the email for context |

> Historical note: `components/shared/create-issue.tsx` still has a **Project** type in its type-picker that calls `POST /issues/project` to create a Linear project directly (see `handleCreateProject` in `supabase/functions/issues/createIssue.ts`). That entry point is no longer wired up anywhere in the UI — the Client Dashboard used to expose it via the "Create Issue" button, but that button was replaced by the email-based flow above.

---

## 2. Issue State Machine

Issues move through these states in order:

```
Backlog → Planning → Business Review → Development → QA → UAT → Done
```

Defined in `STATUS_ORDER` (`components/client/issues.types.ts`) — used for sorting/ordering elsewhere in the app. The Description tab has no generic "advance to next state" control. State only changes at these specific points, available to every role:

- **Business Review → Development**: a **"Complete Review"** button appears once every question in the Decisions tab has an answer (or none were asked yet — `reviewComplete`).
- **UAT → Done / QA**: two buttons appear while the issue is in UAT — **"Approved"** (→ `Done`) and **"Fixes Required"** (→ back to `QA`).
- **Done → Development**: a **"Move back to Development"** button reopens a completed issue.

All of the above call `PATCH /issues` with `{ issueId, stateName }`.

---

## 3. Test Cases

**Where:** Tests tab inside the Issue Detail Modal (`issue-detail-modal.tsx` → `TestsTab`).

**Full flow:**

```
draft → Stakeholder approves → Developer records QA Evidence (QA stage)
      → Stakeholder records UAT Result (UAT stage) → Stakeholder marks Passed
```

### 3a. Creating / editing a test (`canManageTests`)

Allowed for:
- **Admin** — always.
- **Developer** — only while the issue's current state is **Development** or **QA**.

1. Opens an issue → **Tests** tab → **+ Add test case**.
2. Fills in:
   - **Title** — what is being tested
   - **Steps** — one per line; saved as `{ order, description }[]`
   - **Expected result** — what should happen
3. Submits → `POST /tests` with `{ issue_id, title, steps, expected, created_by }`.
4. Test is created with status **`draft`**.

Draft tests can also be edited (title/steps/expected) by the same role gate, via **"Edit test case"** → `PATCH /tests/update`.

### 3b. Approving a test (Customer / Stakeholder)

1. Customer/stakeholder opens the issue → **Tests** tab.
2. Sees test cases with status `draft` and an **"Approve test case"** button.
3. Clicks it → `PATCH /tests/approve` with `{ test_id, approved_by }`.
4. Status moves to **`approved`**.

### 3c. Recording QA Evidence (Developer, only while issue is in QA state)

1. Issue must be in **QA** state.
2. Developer opens the issue → **Tests** tab.
3. Tests with status `draft`, `approved`, or `passed` show a **"Record QA"** button (drafts are included so a developer can attach evidence before the stakeholder has approved the test case).
4. Developer clicks it, types what actually happened, clicks **"Save QA"**.
5. `PATCH /tests/uat` is called with `{ test_id, actual, recorded_by, kind: "qa" }`.
6. The entry is appended to `test.actual[]` and rendered under a **"QA Evidence"** label. Status is unchanged by this action.

> Developers cannot record UAT results, and customers/stakeholders cannot record QA evidence — each recording action is gated to both the right role **and** the right issue stage (`canRecordResult` in `TestsTab`).

### 3d. Recording UAT Result (Customer / Stakeholder, only while issue is in UAT state)

1. Issue must be in **UAT** state.
2. Customer/stakeholder opens the issue → **Tests** tab.
3. Approved tests show a **"Record UAT"** button. It disappears once the test is `passed` (no need to re-record after sign-off).
4. Customer/stakeholder clicks it, types what actually happened, clicks **"Save UAT"**.
5. `PATCH /tests/uat` is called with `{ test_id, actual, recorded_by, kind: "uat" }`.
6. The entry is appended to `test.actual[]` and rendered under a **"UAT Result"** label (older entries recorded before `kind` existed fall back to a generic "Actual" label).

### 3e. Marking a test Passed (Stakeholder only, final approval)

1. Issue must be in **UAT** state and the test must already be `approved` or `passed`.
2. The test must have **at least one recorded UAT Result** (`test.actual` contains an entry with `kind: "uat"`) — a stakeholder cannot mark a test passed without first recording a UAT result.
3. Stakeholder clicks **"Mark as Passed"** → `PATCH /tests/uat` with `{ test_id, passed: true }`. Status moves to **`passed`**.
4. Can be reverted via **"Revert to Approved"** → `{ test_id, passed: false }` (this button isn't gated by the UAT-record check).

**Test status flow:**

```
draft → approved → passed
                 → failed  (status exists in the type but not yet wired to a UI action)
```

---

## 4. Questions & Decisions

**Where:** Decisions tab inside the Issue Detail Modal (`issue-detail-modal.tsx` → `DecisionsTab`).

Decisions data is fetched from Supabase `decisions` table on modal open.

### 4a. Developer asks a question

1. Developer opens an issue → **Decisions** tab → **"Ask a question"**.
2. Types the question, submits with the button or `Cmd/Ctrl + Enter`.
3. `POST /issues` is called with `{ issueId, question, ownerEmail }`.
4. The new decision appears in the list with no answer yet.

### 4b. Customer answers

1. Customer opens the same issue → **Decisions** tab.
2. Sees unanswered questions each with a **"Submit your decision"** button.
3. Clicks it, types their decision, submits with the button or `Cmd/Ctrl + Enter`.
4. `PATCH /issues/decision` is called with `{ decisionId, decision, decisionEmail }`.
5. The decision body, email, and timestamp appear under the question.

**Unread badge:** When an issue has unanswered decisions the question count shows as a badge on the issue card. Opening the modal automatically calls `POST /decisions/read`, which clears the badge locally via `locallyRead` state in `PriorityTasks`.

---

## 5. CometChat (Issue Chat)

**Where:** Chat tab inside the Issue Detail Modal (`components/chat/CometChat/IssueCometChat.tsx`, rendered as `<IssueCometChat issueId issueTitle slug />`).

Each issue has its own CometChat **group** keyed to a deterministic GUID (`issue_{issueId}`) — but unlike the standalone Chat page's groups, it's created **lazily**: opening the tab only looks up whether a group already exists (from a prior message), it never creates one or adds members just for viewing.

**On open:** if a group exists, it's loaded, joined, and its recent history fetched. If not, the tab shows an empty "Start the conversation" state with no group and no members yet.

**Sending the first message:** the group is created at that point — members are resolved from the *sender's* role (customer/stakeholder pull in their assignments the same way support-chat groups do; a developer/admin sending first resolves the issue's customer from the `slug` prop instead), the group name is de-duplicated against existing group names, and ownership is transferred to a fixed staff account so the opener can leave it later. A "Creating chat and adding users…" loader shows while this happens. Every message after that behaves like a normal group chat (real-time listener, join-on-view, 50-message history).

**Layout:** Messages are shown with user initials avatars, sender name, and timestamp. The list auto-scrolls to the latest message on load and on new messages.

> Full detail on the lazy-creation logic, member resolution, and ownership handoff lives in `app/docs/CHAT_FLOWS.md` → "Issue Chat" — this section stays a summary since the mechanics are shared with the standalone Chat page's group creation.

---

## 6. Design Tab — Services & Diagrams

**Where:** Design tab inside the Issue Detail Modal (`issue-detail-modal.tsx` → `DesignTab`).

> Both the **Design** and **Demo** tabs are hidden for Bug issues (`isBugIssue`, computed from `issue.labels.nodes` containing a label named "bug") — neither is relevant to a bug ticket, so the tab bar only shows Description / Chat / Tests / Decisions for those.

A **Service** is a Supabase-only concept — it has no link to Linear at all (an earlier version tied it to a Linear label; that was dropped). `portal.services` rows are scoped by `project_slug`, the same customer/workspace slug used everywhere else in the portal (`document.project_slug`, the `/{slug}/dashboard/...` URL param). The Design tab reads it from `CustomerSlugContext` (`useCustomerSlug()`) rather than from the issue, which is what makes it work identically regardless of the viewer's role — customer, stakeholder, developer, or an admin previewing a customer.

Diagrams are **Mermaid** (`.mmd`) files, versioned per service, each one uploaded from a specific issue.

### 6a. Picking or creating a service

1. Opening the Design tab loads `GET /diagrams?type=services&project_slug={slug}` into the **Servicio** dropdown — every service belonging to the current customer.
2. Selecting **"+ Crear servicio nuevo"** swaps the second control to a plain text input for the new service's name. No Linear lookup involved.
3. Selecting an existing service instead turns the second control into a **version picker**, populated from `GET /diagrams?service_id={id}` (newest first, latest marked "última").

**Defaulting to the last service used on this issue:** on open, the tab also calls `GET /diagrams?issue_id={issue.id}` (any service) and, if the dropdown hasn't been touched yet (`selectedServiceId` still empty), auto-selects the `service_id` of the most recent row. This only fires once per mount — picking a different service or "crear nuevo" afterward is never overridden, since `selectedServiceId` is no longer empty at that point.

For this to point at the actual most-recent upload, `GET /diagrams?issue_id=` sorts by `created_at` rather than `version` — an issue can upload to more than one service over time, and `version` is only meaningful within a single service, so `created_at` is the only field that reliably answers "what did this issue touch last." `GET /diagrams?service_id=` still sorts by `version` (that ordering is what feeds the version picker in 6a.3 above).

### 6b. Uploading a diagram

1. **"Subir nueva versión"** opens the file picker (`accept=".mmd,.mermaid,text/plain"`).
2. On file select, `POST /diagrams` is called as `multipart/form-data` with `file`, `project_slug`, `issue_id`, `email`, and either `service_id` (existing service) or `service_name` (new service).
3. Backend (`supabase/functions/diagrams/createDiagram.ts`):
   - If `service_id` was sent, fetches that row and validates it belongs to `project_slug` (`getService.ts`) — this stops one customer from uploading against another customer's service by guessing an id.
   - If `service_name` was sent instead, creates a brand-new `services` row directly (`createService.ts`) — no existence check needed, since the frontend only sends `service_name` when the user explicitly picked "crear nuevo" and typed a name, and `(project_slug, name)` is `UNIQUE` at the DB level as a backstop.
   - Computes the next `version` for that service (`max(version) + 1`).
   - Uploads the file to the **`diagrams_bucket`** Storage bucket (private, no public/RLS policies — only ever touched by this edge function via the service-role key, same access pattern as `downloadDocument.ts`'s signed URLs for `documents_bucket`).
   - Inserts a `diagrams` row with `service_id`, `issue_id`, `version`, `storage_path`, and a cached `mermaid_source` text column (so rendering never has to read back from Storage).
4. On success, the frontend selects the new service/version and invalidates the `diagram-services` and `diagram-versions` queries so both controls refresh.

This is how a diagram ends up linked to **both** the issue (`issue_id`) and the service (`service_id`) from a single upload, as opposed to being two separate steps. A service only ever comes into existence together with its first diagram — there's no way to create an empty service.

### Rendering

The selected version's `mermaid_source` is rendered client-side with `mermaid.render()` (the `mermaid` npm package) into inline SVG. This was chosen over converting Mermaid syntax into ReactFlow nodes/edges — Mermaid already does its own parsing and layout, so there was no need to reimplement that on top of ReactFlow just to reuse the same diagram widget as the rest of the app.

### API — `supabase/functions/diagrams`

**`GET /diagrams`**

| Query param | Returns |
|---|---|
| `type=services&project_slug=` | All services for that customer (every row is guaranteed to have ≥1 diagram) |
| `service_id` | Version history for that service, ordered by `version` desc (newest first) |
| `issue_id` | All diagrams uploaded from that issue, across any service, ordered by `created_at` desc (most recently uploaded first — used to default the Servicio dropdown) |

**`POST /diagrams`** (`multipart/form-data`)

| Field | Required | Notes |
|---|---|---|
| `file` | ✅ Yes | The `.mmd` file |
| `project_slug` | ✅ Yes | Customer/workspace slug the service belongs to |
| `service_id` | One of these two | Upload a new version to an existing service |
| `service_name` | One of these two | Create a brand-new service, named by the user |
| `issue_id` | ✅ Yes | Issue the upload was triggered from |
| `email` | ✅ Yes | Uploader — resolved to `users.id` server-side for `uploaded_by` |

### Known gaps

- **No GitHub sync** — pushing the latest diagram version to the project's GitHub repo (from the original feature notes) hasn't been built.

---

## 7. Demo Tab — Video Walkthroughs

**Where:** Demo tab inside the Issue Detail Modal (`issue-detail-modal.tsx` → `DemoTab`). Hidden for Bug issues (see the note in section 6).

A demo is a **versioned** record per issue (`portal.demo_videos`, `UNIQUE(issue_id, version)`) — v1, v2, v3, … A version's content is either an **uploaded video file** or an **embed link** (e.g. Loom), tracked via `source_type: "upload" | "embed"`. Every version also has its own **feedback thread** (`portal.demo_video_comments`) that customers, stakeholders, and developers/admins all read and post to.

### 7a. Adding a brand-new version

Two independent entry points, both create version **N+1** (`getNextVersion` = current max + 1 for that issue):

- **"Upload demo" / "Upload new version"** — opens a file picker (`accept="video/*"`), then `POST /demo-videos` as `multipart/form-data` with `file`, `issue_id`, `email`. Backend validates the file (whitelisted video MIME types, non-empty, ≤500 MB — `validateVideoFile`), stores it at `{issueId}/v{n}/{uuid}{ext}` in the private `demo-videos` Storage bucket, and inserts the row.
- **"Add embed link"** — reveals a URL input; submitting calls `POST /demo-videos` as JSON with `issue_id`, `email`, `embed_url`. Backend validates the URL is `https` and stores it directly (no file involved).

Either call fails cleanly with "Someone else just added a new version — please try again" if two uploads race for the same version number (`UNIQUE(issue_id, version)` catches the collision, `code 23505`).

### 7b. Replacing the currently-selected version's content

Distinct from 7a — this keeps the **same version number**, it just swaps what that version points to. Both actions target `currentDemo` (whichever version is selected in the dropdown):

- **"Replace v{n} with file"** — `PUT /demo-videos` (`multipart/form-data`) with `demo_id`, `email`, `file`. Uploads the new file to a fresh storage path first, updates the row, then deletes the old storage object (only if the version being replaced was itself an upload).
- **"Replace v{n} with link"** — `PUT /demo-videos` (JSON) with `demo_id`, `email`, `embed_url`. Updates the row to `source_type: "embed"` and clears `file_name`/`storage_path`; if the version being replaced was an upload, the old storage object is deleted afterward.

Both are only available once a version exists — there's no "replace" affordance before the first version is created.

### 7c. Playback & embeds

- **Uploads:** `GET /demo-videos?issue_id=` signs a fresh 1-hour URL (`createSignedUrl`) for every upload-type row on every fetch — the bucket is private, so nothing is ever served from a permanent public URL.
- **Embeds:** rendered in an `<iframe>`. Loom links get rewritten from `loom.com/share/{id}` to the embeddable `loom.com/embed/{id}` form (`getEmbedIframeSrc`); other providers are embedded as-is via their share URL. `embed_provider` is derived from the URL's hostname (`detectEmbedProvider`) and shown as e.g. "loom link" in the version's metadata footer.

### 7d. Feedback per version

Switching the **Version** dropdown switches the feedback thread shown below the player — comments are scoped to `demo_video_id`, not to the issue as a whole, so feedback on v1 doesn't show up while viewing v2.

1. Anyone (customer/stakeholder/developer/admin) opens the Demo tab, picks a version, types in the feedback box, clicks **"Post feedback"**.
2. `POST /demo-videos?type=comments` with `{ demo_video_id, email, body }`.
3. Comment appears with the author's name, role badge, and timestamp — same list for every role.

### API — `supabase/functions/demo-videos`

| Method | Purpose | Body |
|---|---|---|
| `GET /demo-videos?issue_id=` | List every version for an issue, newest first, with signed `file_url` for uploads | — |
| `GET /demo-videos?type=comments&demo_video_id=` | List a version's feedback thread, oldest first | — |
| `POST /demo-videos` (multipart) | Add a new version from a file | `file`, `issue_id`, `email` |
| `POST /demo-videos` (JSON) | Add a new version from an embed link | `issue_id`, `email`, `embed_url` |
| `POST /demo-videos?type=comments` | Post feedback on a version | `demo_video_id`, `email`, `body` |
| `PUT /demo-videos` (multipart) | Replace the selected version's content with a file | `demo_id`, `email`, `file` |
| `PUT /demo-videos` (JSON) | Replace the selected version's content with an embed link | `demo_id`, `email`, `embed_url` |

---

## File Map

| File | Responsibility |
|---|---|
| `components/shared/create-issue.tsx` | Create Issue dialog (all types) |
| `components/client/request-project-dialog.tsx` | "New project Request" dialog — emails admins instead of creating in Linear |
| `supabase/functions/project-requests/createProjectRequest.ts` | Looks up `role === "admin"` users and triggers the notification email |
| `supabase/functions/project-requests/sendProjectRequestMail.ts` | Resend email template for project requests |
| `components/client/issues.types.ts` | Shared types, color maps, STATUS_ORDER |
| `components/client/issue-detail-modal.tsx` | Modal shell + Description / Decisions / Tests tabs; `canManageTests`/`canRecordResult` role+stage gating lives here; also owns `isBugIssue` (hides Design/Demo tabs) |
| `supabase/functions/tests/index.ts` | Test CRUD, approve, and `/uat` (QA Evidence / UAT Result recording, `passed` toggle) |
| `components/client/issue-cards.tsx` | IssueCard (grid view) and IssueListRow (compact view) |
| `components/client/priority-tasks.tsx` | Main list with filters and search |
| `components/chat/CometChat/IssueCometChat.tsx` | Per-issue real-time chat |
| `components/client/design-tab.tsx` | Design tab — service/version dropdowns, Mermaid upload, and `MermaidDiagram` SVG renderer |
| `supabase/functions/diagrams/index.ts` | Router — `GET`/`POST` for diagrams, hardcoded to the `portal` schema like `users/index.ts` |
| `supabase/functions/diagrams/listDiagrams.ts` | Services-with-diagrams, version history by service, or diagrams by issue |
| `supabase/functions/diagrams/createDiagram.ts` | Uploads a `.mmd` to `diagrams_bucket` and inserts the `diagrams` row |
| `supabase/functions/diagrams/createService.ts` | Inserts a new `services` row (only called when the user picks "crear nuevo") |
| `supabase/functions/diagrams/getService.ts` | Fetches an existing `services` row, scoped to `project_slug` |
| `context/CustomerSlugContext.tsx` | Source of `project_slug` for the Design tab — same slug used across the portal, role-independent |
| `components/client/demo-tab.tsx` | Demo tab — version picker, upload/embed forms (new version + replace-in-place), player, per-version feedback thread |
| `supabase/functions/demo-videos/index.ts` | Router — `GET`/`POST`/`PUT` for demo videos and their comments |
| `supabase/functions/demo-videos/createDemoVideo.ts` | Adds a new version (`getNextVersion` = max + 1) from an upload or an embed link |
| `supabase/functions/demo-videos/updateDemoVideo.ts` | Replaces an existing version's content in place (file or embed), cleaning up the old storage object if one existed |
| `supabase/functions/demo-videos/listDemoVideos.ts` | Lists all versions for an issue with freshly signed playback URLs |
| `supabase/functions/demo-videos/listComments.ts` / `createComment.ts` | Per-version feedback thread CRUD |
| `supabase/functions/demo-videos/helpers.ts` | Video/embed-URL validation, signed URL helper, `SCHEMA`/`BUCKET` constants |
