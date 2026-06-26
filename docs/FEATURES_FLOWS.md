# Portal Flows

Reference for how the main customer-developer collaboration flows work end to end.

---

## Roles

| Role | What they can do |
|---|---|
| `customer` | Approve tests, submit decisions, record UAT results, approve Business Review, **create Linear projects** |
| `stakeholder` | Approve tests, submit decisions, record UAT results, approve Business Review |
| `developer` / `admin` | Create issues, ask questions, advance issue state, create test cases |

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

`profile.linear_slug` is only set directly on the profile for `role: "customer"` users (their `users.customer_id` points to a `customers` row, which has `linear_slug`). Stakeholders/developers don't have it at the top level — their customer associations live in `profile.assignment_id[].linear_slug`, keyed by `clientName`. Pages rendering `CreateIssue` for non-customer roles (e.g. `app/[slug]/dashboard/(portal)/client/page.tsx`) must compute `linearSlug` by matching `profile.assignment_id[].clientName` against the currently selected customer slug and pass it as the `linearSlug` prop — otherwise the Project dropdown stays empty for stakeholders.

---

## 1b. New Project Request *(Client Dashboard)*

**Entry point:** "New project Request" button — `components/client/request-project-dialog.tsx` — rendered next to the project filters on the Client Dashboard (`app/[slug]/dashboard/(portal)/client/page.tsx`).

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

Defined in `STATUS_ORDER` (`components/client/issues.types.ts`).

- **Developer / Admin** sees a "Move to `<next state>`" button on the Description tab and can advance the issue forward.
- **Customer / Stakeholder** sees an **"Approve user stories & acceptance criteria"** button specifically when the issue is in **Business Review**, which also advances it to the next state.
- State is updated via `PATCH /issues` with `{ issueId, stateName }`.

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

**Where:** Chat tab inside the Issue Detail Modal (`components/chat/CometChat/IssueCometChat.tsx`).

Each issue has its own CometChat **group** keyed to `issue.id`.

**On open:**
1. `IssueCometChat` receives `issueId` and `issueTitle`.
2. The component looks up or creates a CometChat group for that issue.
3. The current user is added to the group if not already a member (registered via `supabase` user record → CometChat UID).
4. Recent message history is fetched and displayed.

**Sending a message:**
1. User types in the input and presses `Enter` or clicks Send.
2. `CometChat.sendMessage()` is called with the group GUID.
3. A real-time listener (`CometChat.addMessageListener`) pushes incoming messages to the list.

**Layout:** Messages are shown with user initials avatars, sender name, and timestamp. The list auto-scrolls to the latest message on load and on new messages.

---

## File Map

| File | Responsibility |
|---|---|
| `components/shared/create-issue.tsx` | Create Issue dialog (all types) |
| `components/client/request-project-dialog.tsx` | "New project Request" dialog — emails admins instead of creating in Linear |
| `supabase/functions/project-requests/createProjectRequest.ts` | Looks up `role === "admin"` users and triggers the notification email |
| `supabase/functions/project-requests/sendProjectRequestMail.ts` | Resend email template for project requests |
| `components/client/issues.types.ts` | Shared types, color maps, STATUS_ORDER |
| `components/client/issue-detail-modal.tsx` | Modal shell + Description / Decisions / Tests tabs; `canManageTests`/`canRecordResult` role+stage gating lives here |
| `supabase/functions/tests/index.ts` | Test CRUD, approve, and `/uat` (QA Evidence / UAT Result recording, `passed` toggle) |
| `components/client/issue-cards.tsx` | IssueCard (grid view) and IssueListRow (compact view) |
| `components/client/priority-tasks.tsx` | Main list with filters and search |
| `components/chat/CometChat/IssueCometChat.tsx` | Per-issue real-time chat |
