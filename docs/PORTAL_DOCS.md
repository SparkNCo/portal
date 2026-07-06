# SparkCo Portal — Complete Documentation

> Single reference file for all portal flows, panels, and components.  
> Last consolidated from: FEATURES_FLOWS, LOGIN_FLOWS, ADMIN_FLOWS, CLIENT_DASHBOARD_FLOWS, DEVELOPER_DASHBOARD_FLOWS, ROADMAP_FLOWS, DOCUMENTS_FLOWS, CHAT_FLOWS, SETTINGS_FLOWS.

---

## Table of Contents

1. [Roles & Permissions](#1-roles--permissions)
2. [Login & Authentication](#2-login--authentication)
3. [Admin Panel](#3-admin-panel)
4. [Issue Flows](#4-issue-flows)
5. [Client Dashboard](#5-client-dashboard)
6. [Developer Dashboard](#6-developer-dashboard)
7. [Roadmap](#7-roadmap)
8. [Documents](#8-documents)
9. [Chat](#9-chat)
10. [Settings](#10-settings)
11. [Environments & Schema Routing](#11-environments--schema-routing)

---

---

## 1. Roles & Permissions

The portal has four roles. Each role gets a different dashboard, a different sidebar, and different permissions inside every panel.

---

### Admin

**How accounts are created:** Directly in the **Supabase Authentication UI** — admins are not created through the portal itself.

**What they can do:**
- Access the **Admin Panel** (`/admin`) to create and manage all other users (developers, customers, stakeholders).
- Assign developers and stakeholders to customers.
- Preview any customer's full portal (Dashboard, Roadmap, Documents, Chat, Settings) via the Dashboards view.
- Ask questions and advance issue states (same permissions as developers).

**Sidebar:** Users, Dashboards, Chat

---

### Developer

**How accounts are created:** Admin creates them via the **Add Developer** button in the Admin Panel. The developer receives an invitation email with a link to set their password and complete their profile at `/set-password`.

**What they can do:**
- View all active issues across their assigned customers.
- Ask questions on issues (Decisions tab) and submit them to the client.
- Advance issue state (e.g. move from QA to UAT).
- Create and manage test cases.
- Upload and view documents.
- Must agree to company policies on first login (Policy Approval Modal).

**Sidebar:** Developer, Chat, Documents

---

### Customer

**How accounts are created:** Admin creates them via the **Add Customer** button in the Admin Panel — requires email, Stripe Customer ID, and Linear Slug. The customer receives an invitation email.

**What they can do:**
- View their project's active issues in two focused lists: Business Review (needs approval) and UAT (needs testing).
- Approve user stories in Business Review, unblocking development.
- Answer questions asked by the dev team (Decisions tab).
- Approve test cases and record UAT results.
- View project stats, DORA metrics, roadmap, and documents.
- Manage billing and staffing in Settings.

**Sidebar:** Dashboard, Roadmap, Documents, Chat, Settings

---

### Stakeholder

**How accounts are created:** Admin creates them via the **Add Stakeholder** button in the Admin Panel. The stakeholder receives an invitation email.

**What they can do:**
- Same portal access as a customer (Dashboard, Roadmap, Documents, Chat).
- Can approve tests, answer decisions, and record UAT results.
- Cannot access Settings (no billing or staffing panels).
- Typically a secondary contact on the client side who reviews and approves but is not the primary account owner.

**Sidebar:** Dashboard, Roadmap, Documents, Chat

---

### Permissions at a glance

| Action | Admin | Developer | Customer | Stakeholder |
|---|---|---|---|---|
| Create users | ✅ | ✗ | ✗ | ✗ |
| Assign developers to customers | ✅ | ✗ | ✗ | ✗ |
| Advance issue state | ✅ | ✅ | ✗ | ✗ |
| Ask questions (Decisions tab) | ✅ | ✅ | ✗ | ✗ |
| Answer questions / submit decisions | ✗ | ✗ | ✅ | ✅ |
| Approve Business Review | ✗ | ✗ | ✅ | ✅ |
| Approve test cases | ✗ | ✗ | ✅ | ✅ |
| Record UAT results | ✗ | ✗ | ✅ | ✅ |
| Create test cases | ✅ | ✗ | ✗ | ✗ |
| Upload documents | ✅ | ✅ | ✅ | ✅ |
| View billing & staffing (Settings) | ✅ | ✗ | ✅ | ✗ |
| Preview any customer's dashboard | ✅ | ✗ | ✗ | ✗ |

> These permissions are derived from `profile.role` (UserContext) and evaluated as `canAnswer` (customer/stakeholder) and `canAsk` (developer/admin) inside `IssueDetailModal`.

---

---

## 2. Login & Authentication

> Entry point: `app/page.tsx` → renders `<LoginForm />` from `app/login/Login.tsx`

### Authentication routes

| Route | Purpose |
|---|---|
| `/` | Login page — shown to everyone who is not authenticated |
| `/set-password` | First-time setup — new users arriving via invitation email |
| `/reset-password` | Password reset — users arriving via a "forgot password" email link |

### 2.1 Login Flow

The login page shows a centered card with the SparkCo logo, an email input (labeled "Username"), a password input, a "Forgot your password?" link, and a Login button.

**Step 1 — Supabase authentication**

When the user submits the form, `supabase.auth.signInWithPassword({ email, password })` is called. If Supabase returns an error, the error message is shown on screen and the flow stops.

**Step 2 — Fetch the user profile**

If Supabase authentication succeeds, the app calls `GET /users?email={email}` to load the user's full profile from the backend — including their role and assignment data.

**Step 3 — Role-based redirect**

| Role | Redirect destination | Condition |
|---|---|---|
| `admin` | `/{clientName}/dashboard/admin` | Always |
| `customer` | `/{clientName}/dashboard/client` | Always |
| `developer` | `/{assignment[0].clientName}/dashboard/developer` | Always |
| `stakeholder` | `/{assignment[0].clientName}/dashboard/client` | Requires at least one customer assignment |

> **Important:** Stakeholders with no assignment cannot log in — they see "No client assigned to this account. Contact your administrator." The admin must assign them to a customer first (see Admin Panel section).

### 2.2 Forgot Password Flow

**Step 1 — Open the modal**

The user clicks "Forgot your password?" on the login form. A modal appears with an email input and a "Send link" button.

**Step 2 — Request the reset email**

The app calls `POST /reset-password` with `{ email }`. On success, the modal switches to a confirmation screen. On failure, an error appears inside the modal.

**Step 3 — User clicks the link in their email**

The email contains a link to `/reset-password` with a token embedded in the URL hash.

**Step 4 — Reset password page (`/reset-password`)**

- If the link is **expired** (`error_code=otp_expired` or `error=access_denied` in the hash) → shows "Link expired" with a back-to-login button.
- If **valid** → listens for the `PASSWORD_RECOVERY` Supabase event, then shows the new password form (min 6 chars, show/hide toggle).
- On submit → `supabase.auth.updateUser({ password })`. On success → redirects to `/` after 3 seconds.

### 2.3 First-Time Setup — New User Invitation

**Route:** `/set-password`

The invitation email link lands the user on `/set-password`. The page detects the Supabase session via `onAuthStateChange` listening for `SIGNED_IN` / `INITIAL_SESSION`. It fetches the user record from Supabase `users` table to pre-populate any fields the admin already filled in.

**Form fields:**

| Field | Required | Notes |
|---|---|---|
| Email | Read-only | Pre-filled, cannot be changed |
| First name | ✅ Yes | |
| Last name | ✅ Yes | |
| Client name / Username | ✅ Yes | Becomes the URL slug (spaces → hyphens) |
| Phone number | No | |
| New password | ✅ Yes | Min 8 characters |
| Confirm password | ✅ Yes | Must match |

**On submit:** Two sequential calls:
1. `supabase.auth.updateUser({ password })` — sets the password in Supabase Auth.
2. `PATCH /users` with `{ id, firstName, lastName, clientName, phoneNumber? }` — saves profile.

**Redirect after setup:**

| Role | Redirect |
|---|---|
| `customer` | `/{clientName}/dashboard/dashboards?customer={clientName}&panel=client` |
| Everyone else | `/{clientName}/dashboard/dashboards` |

### 2.4 Error states

| Situation | What the user sees |
|---|---|
| Wrong email or password | Error message below the password field |
| Supabase session not found | "User session not found" |
| Developer / stakeholder with no assignment | "No client assigned to this account. Contact your administrator." |
| Reset email request fails | Error message inside the forgot password modal |
| Reset link is expired | "Link expired" screen with back-to-login button |
| Passwords don't match | "Passwords do not match." |
| Password too short | Minimum length error message |
| Profile save fails after password set | "Password set, but could not save your profile." |

### 2.5 File Map

| File | Responsibility |
|---|---|
| `app/page.tsx` | Entry point — renders LoginForm |
| `app/login/Login.tsx` | Login form + forgot password modal logic |
| `app/reset-password/page.tsx` | Password reset page |
| `app/set-password/page.tsx` | First-time profile + password setup |
| `context/UserContext.tsx` | Holds the authenticated profile, provides `reloadUser()` |
| `lib/supabase-client.ts` | Supabase client used for auth operations |

---

---

## 3. Admin Panel

> Main page: `app/admin/users/page.tsx` → `AdminUsersPage`

### Access & Security

Only accessible to users with `role === "admin"`. Any other role sees "Not authorized". The role comes from `UserContext`, loaded from Supabase on login.

### Page Structure

Two views toggled from a switcher:

| View | Description |
|---|---|
| **Users** | Lists every user in the system with their roles and lets you manage them |
| **Projects** | Shows each customer and which developers / stakeholders are assigned to them |

Three action buttons in the top-right: `Add Developer`, `Add Customer`, `Add Stakeholder`.

### 3.1 Users View

On mount calls `GET /users`. Each row shows: initials avatar, email, colored role badge, expand arrow, and an **Assign** button (hover only, developers/stakeholders only).

**Search & filters:**
1. Text search — filters by email or username in real time, no API calls.
2. Role filter — pill buttons (admin / developer / customer / stakeholder), combinable with search.

**Expanding a user:**
- **Customer** → shows assigned developers/stakeholders with role, join date, weekly hours.
- **Developer / Stakeholder** → shows assigned customers with join date and weekly hours.

Data loads on demand: `GET /assignments?developer={id}` or `GET /assignments?customer_id={id}`.

### 3.2 Projects View

Same assignment data, organized from the customer's perspective. Each block represents a customer with all their assignees. Data loads in batch: `GET /assignments?customer_id=id1,id2,...`.

### 3.3 Add Developer — `AddDeveloperModal`

| Field | Required | Notes |
|---|---|---|
| Email | ✅ Yes | Login identifier |
| First name | No | |
| Last name | No | |
| Username | No | Sent as `clientName` |
| Phone number | No | |

Calls `POST /users?type=developer`. The `origin` field (portal URL) is used by the backend to build the invitation email link. On success the user list refreshes.

### 3.4 Add Customer — `AddClientModal`

| Field | Required | Notes |
|---|---|---|
| Email | ✅ Yes | |
| Client name | No | Display name seen by developers |
| First name | No | |
| Last name | No | |
| Phone number | No | |
| Stripe Customer ID | ✅ Yes | Used for billing |
| Linear Slug | ✅ Yes | Identifies the customer's Linear workspace |

> "Create" button is disabled until all three required fields are filled. `linear_slug` is critical — without it the customer won't see issues and the team can't create requests.

Calls `POST /users?type=customer`.

### 3.5 Add Stakeholder — `AddStakeholderModal`

| Field | Required | Notes |
|---|---|---|
| Email | ✅ Yes | |
| First/Last name | No | |
| Username | No | Sent as `userName` |
| Phone number | No | |

Calls `POST /users?type=stakeholder`.

### 3.6 Assign Developer/Stakeholder to a Customer — `AssignCustomerModal`

Opened via the **Assign** hover button on any developer or stakeholder row.

1. Shows current assignments first (already-assigned customers are disabled in the dropdown).
2. Select customer from dropdown.
3. For **developers**: enter weekly hours (`allocation`). Not shown for stakeholders.
4. Click **Assign** → `POST /assignments` with `{ user_id, customer_id, role, allocation }`.

On success: user list and expanded assignment panel both refresh.

### 3.7 Full Onboarding Flow

```
1. Create the Customer           → email + Stripe ID + Linear slug required
2. Create the Developers         → email only required
3. (Optional) Create Stakeholders
4. Assign each Developer         → Users list → hover → Assign → select customer + hours
5. (Optional) Assign Stakeholders → same flow, no allocation
6. Verify in Projects view       → customer block shows all assignees
```

### 3.8 API Endpoints

| Action | Method | Endpoint |
|---|---|---|
| List all users | GET | `/users` |
| Create developer | POST | `/users?type=developer` |
| Create customer | POST | `/users?type=customer` |
| Create stakeholder | POST | `/users?type=stakeholder` |
| List assignments for multiple customers | GET | `/assignments?customer_id=id1,id2,...` |
| List assignments for a developer/stakeholder | GET | `/assignments?developer={id}` |
| List assignments for a customer | GET | `/assignments?customer_id={id}` |
| Create assignment | POST | `/assignments` |

### 3.9 File Map

| File | Responsibility |
|---|---|
| `app/admin/users/page.tsx` | Main page — Users and Projects views |
| `app/admin/users/AddDeveloperModal.tsx` | Modal to create a developer |
| `app/admin/users/AddClientModal.tsx` | Modal to create a customer |
| `app/admin/users/AddStakeholderModal.tsx` | Modal to create a stakeholder |
| `app/admin/users/AssignCustomerModal.tsx` | Modal to assign developer/stakeholder to a customer |
| `context/UserContext.tsx` | Provides `profile.role` for access control |

---

---

## 4. Issue Flows

> Entry point: "Create Issue" button — `components/shared/create-issue.tsx`

### 4.1 Creating an Issue

The Create Issue dialog opens from any dashboard. A type-picker screen appears first:

| Type | Description | Key fields |
|---|---|---|
| **Bug Report** | Something isn't working | Steps to reproduce, expected, actual |
| **Feature Request** | Suggest an improvement | Description, requirements (optional), project (optional) |
| **UAT Test Case** | Log a test with steps & results | Test steps, expected result, actual result |
| **Project** | New project with goals | Description, due date, milestones (optional) |
| **Milestone** | Add milestone to a project | Target date, description (optional) — requires project selection first |

On submit, all types except Milestone call `POST /issues/create` with `{ title, description, priority, slug, projectId? }`. Milestone calls `POST /issues/milestone`.

A success toast shows the Linear identifier (e.g. `SPA-42`). The dialog closes and resets.

> Note: the **Project** type's entry point above is no longer reachable from the UI. The Client Dashboard — the only page that rendered the full type-picker for `role === "customer"` — now uses a separate "New project Request" button instead (see section 5.2b).

### 4.2 Issue State Machine

```
Backlog → Planning → Business Review → Development → QA → UAT → Done
```

Defined in `STATUS_ORDER` (`components/client/issues.types.ts`).

- **Developer / Admin** advances state via "Move to `<next state>`" button on the Description tab. Calls `PATCH /issues` with `{ issueId, stateName }`.
- **Customer / Stakeholder** sees "Approve user stories & acceptance criteria" button **only in Business Review** — clicking it advances to Development.

### 4.3 Test Cases

**Where:** Tests tab inside the Issue Detail Modal.

**Full flow:** `draft → Stakeholder approves → Developer records QA Evidence (QA stage) → Stakeholder records UAT Result (UAT stage) → Stakeholder marks Passed`

**Creating/editing a test (`canManageTests`: Admin always, or Developer only while issue state is Development/QA)**
1. Tests tab → "+ Add test case"
2. Fill: title, steps (one per line → saved as `{ order, description }[]`), expected result
3. `POST /tests` → test created with status `draft`
4. Draft tests can be edited the same way via `PATCH /tests/update`

**Approving a test (Customer / Stakeholder)**
1. Tests tab → "Approve test case" button on any `draft` test
2. `PATCH /tests/approve` → status moves to `approved`

**Recording QA Evidence (Developer — only when issue is in QA state)**
1. Tests tab → "Record QA" on any `draft`, `approved`, or `passed` test
2. Type what actually happened → "Save QA"
3. `PATCH /tests/uat` with `{ ..., kind: "qa" }` → entry appended to `test.actual[]`, shown as "QA Evidence"

**Recording UAT Result (Customer / Stakeholder — only when issue is in UAT state)**
1. Tests tab → "Record UAT" on any `approved` test (hidden once `passed`)
2. Type what actually happened → "Save UAT"
3. `PATCH /tests/uat` with `{ ..., kind: "uat" }` → entry appended to `test.actual[]`, shown as "UAT Result"

> Each recording action is gated to both the right role *and* the right stage — developers can't record UAT, customers/stakeholders can't record QA evidence.

**Marking Passed (Stakeholder only — only when issue is in UAT state, and only after at least one UAT Result is recorded)**
1. Tests tab → "Mark as Passed" on an `approved`/`passed` test that has a `kind: "uat"` entry in `actual`
2. `PATCH /tests/uat` with `{ passed: true }` → status moves to `passed`
3. Reversible via "Revert to Approved" → `{ passed: false }`

```
draft → approved → passed
                 → failed  (type exists but not yet wired to a UI action)
```

### 4.4 Questions & Decisions

**Where:** Decisions tab inside the Issue Detail Modal. Data fetched from Supabase `decisions` table on modal open.

**Developer asks a question:**
1. Decisions tab → "Ask a question"
2. Type question, submit (button or `Cmd/Ctrl + Enter`)
3. `POST /issues` with `{ issueId, question, ownerEmail }`

**Customer answers:**
1. Decisions tab → "Submit your decision" on any unanswered question
2. Type decision, submit (button or `Cmd/Ctrl + Enter`)
3. `PATCH /issues/decision` with `{ decisionId, decision, decisionEmail }`

**Unread badge:** Unanswered questions show a yellow number badge on the issue card. Opening the modal calls `POST /decisions/read`, which clears the badge locally via `locallyRead` state in `PriorityTasks`. Decision counts refetch every 30 seconds on all dashboards.

### 4.5 Issue Chat (per-issue CometChat)

**Where:** Chat tab inside the Issue Detail Modal (`IssueCometChat`).

Each issue has its own CometChat group keyed to `issue.id`. On open:
1. Component looks up or creates a CometChat group for the issue.
2. Current user is added to the group if not already a member.
3. Recent message history is fetched and displayed.
4. Real-time listener (`CometChat.addMessageListener`) pushes incoming messages live.

Messages show user initials avatars, sender name, and timestamp. The list auto-scrolls to the latest message.

### 4.6 Design Tab — Services & Diagrams

**Where:** Design tab inside the Issue Detail Modal (`issue-detail-modal.tsx` → `DesignTab`).

A **Service** is a Supabase-only concept — no link to Linear (an earlier version tied it to a Linear label; that was dropped). `portal.services` rows are scoped by `project_slug`, the same customer/workspace slug used elsewhere (`document.project_slug`, the `/{slug}/dashboard/...` URL param), read via `CustomerSlugContext` — which is why it works identically regardless of the viewer's role. Diagrams are **Mermaid** (`.mmd`) files, versioned per service, each uploaded from a specific issue.

**Picking or creating a service:**
1. Opening the tab loads `GET /diagrams?type=services&project_slug=` into the **Servicio** dropdown — every service for that customer.
2. **"+ Crear servicio nuevo"** swaps the second control to a plain text input for the new service's name — no Linear lookup involved.
3. Picking an existing service instead turns the second control into a **version picker** (`GET /diagrams?service_id=`, ordered by `version` desc).

**Defaulting to the last service used on this issue:** on open, the tab also calls `GET /diagrams?issue_id=` (ordered by `created_at` desc, since one issue can upload to more than one service and `version` numbers aren't comparable across services) and auto-selects the most recent row's `service_id` — but only if the dropdown hasn't been touched yet, so it never overrides a manual pick.

**Uploading a diagram:**
1. **"Subir nueva versión"** opens a file picker (`accept=".mmd,.mermaid,text/plain"`).
2. `POST /diagrams` (`multipart/form-data`) with `file`, `project_slug`, `issue_id`, `email`, and either `service_id` (existing) or `service_name` (new).
3. Backend either fetches+validates the existing service (`getService.ts`, scoped to `project_slug`) or inserts a new one (`createService.ts`), computes the next `version`, uploads the file to the private `diagrams_bucket` (no Storage policies — access only via the edge function's service-role key), and inserts a `diagrams` row with a cached `mermaid_source` text column.
4. This links the upload to **both** the issue and the service from a single call. A service only ever exists together with its first diagram.

**Rendering:** the selected version's `mermaid_source` is rendered client-side with `mermaid.render()` into inline SVG — chosen over converting Mermaid syntax into ReactFlow nodes/edges, since Mermaid already handles its own parsing and layout.

**Known gaps:** no GitHub sync of the latest diagram version.

### 4.7 File Map

| File | Responsibility |
|---|---|
| `components/shared/create-issue.tsx` | Create Issue dialog (all types) |
| `components/client/issues.types.ts` | Shared types, color maps, STATUS_ORDER |
| `components/client/issue-detail-modal.tsx` | Modal shell + Description / Decisions / Tests / Design tabs |
| `components/client/issue-cards.tsx` | IssueCard (grid view) and IssueListRow (compact view) |
| `components/client/priority-tasks.tsx` | Main issue list with filters and search |
| `components/chat/CometChat/IssueCometChat.tsx` | Per-issue real-time chat |
| `components/client/design-tab.tsx` | Design tab — service/version dropdowns, Mermaid upload, and SVG renderer |
| `supabase/functions/diagrams/index.ts` | Router — `GET`/`POST` for diagrams |
| `supabase/functions/diagrams/listDiagrams.ts` | Services-with-diagrams, version history by service, or diagrams by issue |
| `supabase/functions/diagrams/createDiagram.ts` | Uploads a `.mmd` to `diagrams_bucket` and inserts the `diagrams` row |
| `supabase/functions/diagrams/createService.ts` | Inserts a new `services` row (only called for "crear nuevo") |
| `supabase/functions/diagrams/getService.ts` | Fetches an existing `services` row, scoped to `project_slug` |

---

---

## 5. Client Dashboard

> Main page: `app/[slug]/dashboard/(portal)/client/page.tsx` → `ClientDashboard`

### Who sees it

Users with `role === "customer"` or `role === "stakeholder"` after login. URL: `/{clientName}/dashboard/client`.

### 5.1 Data loaded on mount

**Issues** — `GET /issues?slug={slug}`: fetches all issues for the customer's Linear workspace. Slug resolved from: CustomerSlugContext → URL param → `profile.linear_slug`.

**Decision counts** — `GET /decisions/counts?user_email={email}`: unanswered questions per issue. Refetches every 30 seconds.

**DORA Metrics** — `GET /get-dora-metrics?linear_name={slug}`: engineering performance metrics.

### 5.2 Project filter

A row of filter buttons at the top — one "All" button plus one per unique project found in the issues list. Multiple projects can be selected. Filter is local state only (no API call). All four cards respect the active filter.

### 5.2b New project Request

The **New project Request** button (`components/client/request-project-dialog.tsx`), next to the project filters, opens a dialog with a Title field and an optional rich-text Description. It does **not** create anything in Linear — submitting calls `POST /project-requests`, which looks up every `portal.users` row with `role === "admin"` and emails each one the request via Resend (`supabase/functions/project-requests/`). A success toast confirms the email was sent.

### 5.3 Dashboard Cards (2-column grid)

**Project Stats — `ProgressPieChart`**  
Donut chart of issues by status with legend, total task count, and completion percentage. Computed entirely client-side from `allIssues`.

**DORA Metrics — `SoftwareKPIs`**

| Metric | What it measures |
|---|---|
| Deploy Frequency | How often code is deployed (last 30/90 days) |
| Lead Time for Changes | Commit → production average time |
| MTTR | Average recovery time from incidents |
| Change Failure Rate | % of deployments that caused failures |

**How DORA metrics are calculated** (`supabase/functions/dora/`)

All four metrics are computed from the repo's **merged pull requests** via the GitHub API (`base=main`).

**Deploy Frequency & Change Failure Rate** — these don't use branch names. To classify a PR as a "fix"/hotfix (which excludes it from Deploy Frequency and counts toward Change Failure Rate), the PR title, its labels, or any of its commit messages must **start with** one of these keywords (`ERROR_SIGNALS` in `supabase/functions/dora/github.ts`):

- `revert`, `hotfix`, `rollback`, `bugfix`, `fix/`, `fix:`

Additionally, for Change Failure Rate, a PR title matching `fix: SPA-<id>` is also treated as a fix. A PR only counts toward Deploy Frequency if its CI status is `success` (via the GitHub commit Status API, not Checks/Actions).

**Lead Time for Changes** (`leadTime.ts`) and **MTTR** (`mttr.ts`) have stricter requirements — both PR title prefix AND branch naming matter:

| Metric | PR title must start with | Branch (`pr.head.ref`) must start with |
|---|---|---|
| Lead Time for Changes | `feat/` or `release/` | `<github-issue-number>-` |
| MTTR | `fix/` (in title or any commit message) | `<github-issue-number>-` |

For each matching PR, the branch prefix number is used to fetch a **GitHub Issue** (`GET /repos/{repo}/issues/{number}`) — not a Linear ticket. The metric is then:

- Lead Time: `pr.merged_at - issue.created_at` (hours), averaged across all matching `feat/`/`release/` PRs.
- MTTR: `pr.merged_at - issue.created_at` (hours), averaged across all matching `fix/` PRs.

If no PR satisfies both the title prefix and the `<number>-` branch naming pointing to a real GitHub Issue, `avg_lead_hours` / `average_resolution_hours` come back as `null` and the card shows no data for that metric. Note: if the team uses Linear slugs (e.g. `SPA-123`) instead of numeric GitHub Issue IDs in branch names, these two metrics will never populate.

For correct metrics overall, PRs/commits should follow this naming convention: `feat/<github-issue-number>-...` for features, `fix/<github-issue-number>-...` for bug fixes, and `fix:`/`hotfix`/`revert`/`rollback`/`bugfix` prefixes for hotfix detection.

**How `dora` gets triggered & how Deploy Frequency accumulates over time**

`dora` is not called directly on a schedule. It's triggered once per day, per customer, at the end of the `issueMetrics` cron job (`triggerDoraForAllCustomers()` in `supabase/functions/issueMetrics/index.ts`), which calls `dora` with `method: "all"` for every customer that has a `linear_slug` and `project_url`.

It's also triggered on-demand right after a new customer is created: `createCustomerFlow` (`supabase/functions/users/createCustomerFlow.ts`) derives `linear_projects`/`project_url` from the customer's Linear initiative and, if successful, calls `POST /functions/v1/issueMetrics`, whose final step is the same `triggerDoraForAllCustomers()` call — so the new customer's metrics populate immediately instead of waiting for the next cron run.

- **Change Failure Rate** is recomputed from scratch on every run — it always re-fetches the most recent `limit` merged PRs (default 100, no date filter), so it's a sliding window over PR history, not a cumulative store.
- **Deploy Frequency** is cumulative and stored in `dora_metrics.deploy_freq_details.deployments`. Each run only fetches PRs merged in the **last 24 hours** (`since`) and appends new, deduped entries (by `pr_number`) to the existing list — it never overwrites or drops old entries. `total_deployments`, `deployments_last_30_days`, and `deployments_last_90_days` are all computed from this accumulated list.
- **Implication:** as long as the daily cron runs without gaps, every merged PR (that passes the hotfix/CI filters) eventually gets captured into `deploy_freq_details.deployments`, and Deploy Frequency numbers will be complete and accurate over time. If the cron misses a run for more than 24 hours, any PRs merged during that gap fall outside the `since` window of the next run and are **permanently missed** from Deploy Frequency (they still show up in CFR's sliding-window scan, since that doesn't depend on accumulation).

**Product Decisions — `PriorityTasks` (Business Review)**  
Issues in Business Review state, sorted by unanswered question count. Client reviews and approves user stories here.

**Acceptance Testing — `PriorityTasks` (UAT)**  
Issues in UAT state, sorted by question count. Client records test results here.

### 5.4 Opening chat from a card

The chat icon on each card (hover to reveal) navigates to the chat page with the issue pre-selected:

```
/acme/dashboard/client  →  /acme/dashboard/chat?newChat=SPA-42%20Issue%20title
```

### 5.5 Data flow

```
User lands on /{slug}/dashboard/client
  ├── AuthGate → session check
  ├── GET /issues?slug  → allIssues, businessReviewIssues, uatIssues
  ├── GET /decisions/counts  (refetches every 30s)
  └── GET /get-dora-metrics
```

### 5.6 File Map

| File | Responsibility |
|---|---|
| `app/[slug]/dashboard/(portal)/client/page.tsx` | Main client dashboard page |
| `app/[slug]/dashboard/(portal)/layout.tsx` | Shared layout — AuthGate, Sidebar, ConsentProvider |
| `components/client/progress-pie-chart.tsx` | Project Stats donut chart |
| `components/roadmap/software-kpis.tsx` | DORA Metrics card |
| `components/client/priority-tasks.tsx` | Issue list (Product Decisions + Acceptance Testing) |
| `components/client/issue-detail-modal.tsx` | Issue detail modal |
| `components/client/request-project-dialog.tsx` | "New project Request" dialog — emails admins instead of creating in Linear |
| `supabase/functions/project-requests/createProjectRequest.ts` | Looks up `role === "admin"` users and triggers the notification email |
| `supabase/functions/project-requests/sendProjectRequestMail.ts` | Resend email template for project requests |

---

---

## 6. Developer Dashboard

> Main page: `app/[slug]/dashboard/(portal)/developer/page.tsx` → `DeveloperDashboard`

### Who sees it

Users with `role === "developer"` after login. URL: `/{clientName}/dashboard/developer`.

### Key difference from Client Dashboard

A developer can be **assigned to multiple customers at once**. The dashboard merges issues from all assigned customers into a single view, with a project filter to switch between them.

### 6.1 Data loaded on mount

**Issues** — parallel `GET /issues?slug={clientName}` per assignment using `Promise.all`. Each issue is tagged with `_project = clientName` for filtering. Results merged into `allIssues`. Done issues filtered out.

**Decision counts** — same as client dashboard, refetches every 30 seconds.

### 6.2 Policy Approval Modal

On load, checks `GET /agreePolicies/check?user_id={id}`. If `approved: false`, a **blocking modal** appears — cannot be dismissed without agreeing.

- "View Policies" → opens Notion doc in new tab.
- "I Agree" → `POST /agreePolicies/approve` with `{ userId, notionUrl }`. On success the modal closes.

### 6.3 Issue pre-processing pipeline

```
allIssues
  1. Filter out Done
  2. Sort by question count DESC
  3. Apply project filter (_project === selectedProject)
  4. Apply status filter (selectedStatuses[])
  5. Apply sort (updatedAt DESC or Priority order)
```

### 6.4 Controls

**Project filter** — only shown if assigned to 2+ customers. "All Projects" or per-customer buttons.

**Sort:**

| Mode | Behavior |
|---|---|
| Last Updated *(default)* | `updatedAt` descending |
| Priority | Urgent → High → Medium → Low → No priority |

**Status filter** — built into PriorityTasks filterState. Pill toggles per status derived from current data.

### 6.5 Dashboard Sections

**Row 1 — Quick Links & Tool Shortcuts**

| Quick Link | Purpose |
|---|---|
| Daily Tracker | Airtable form for daily work logging |
| PTO Request | Time off request form |
| Client Escalation | Escalate issues to management |

| Tool Shortcut | Purpose |
|---|---|
| JumpCloud | SSO / device management |
| PostHog | Product analytics |
| GitHub | Code repository |

> Tool Shortcut URLs are currently `#` placeholders — configure in `tool-shortcuts.tsx`.

**Row 2 — All Tasks**  
Full-width `PriorityTasks` with all active issues. Title changes to the selected customer name when a project filter is active.

> The CreateIssue button is currently commented out.

### 6.6 Data flow

```
User lands on /{slug}/dashboard/developer
  ├── AuthGate → session check
  ├── profile.assignment_id[] → projects list
  ├── Promise.all → GET /issues per customer (parallel)
  ├── GET /decisions/counts  (refetches every 30s)
  └── GET /agreePolicies/check
        → if false → PolicyApprovalModal (blocking)
```

### 6.7 File Map

| File | Responsibility |
|---|---|
| `app/[slug]/dashboard/(portal)/developer/page.tsx` | Main developer dashboard |
| `components/developer/quick-links.tsx` | Quick Links card |
| `components/developer/tool-shortcuts.tsx` | Tool Shortcuts card |
| `components/client/priority-tasks.tsx` | Issue list with filter/sort |
| `components/ui/PolicyApprovalModal.tsx` | Blocking policy agreement modal |

---

---

## 7. Roadmap

> Main page: `app/[slug]/dashboard/(portal)/roadmap/page.tsx` → `RoadmapPage`

### Who sees it

`customer`, `stakeholder`, and `admin` (when previewing a customer). Not in the developer sidebar.

### 7.1 Data loaded on mount

`GET /roadmap/?slug={slug}` — returns a Linear initiative with all projects and their milestones.

```
roadmap.initiative.projects.nodes[]
  └── project.name
  └── project.projectMilestones.nodes[]
        └── name, status, progress, targetDate, createdAt
        └── currentProgress { scopeCount, scopeEstimate, ... }
        └── issues.nodes[]
```

A `useEffect` flattens all milestones into `allMilestones[]`, injecting `projectName` onto each.

### 7.2 Projects Timeline — `RoadmapTimeline`

**Year navigation** — left/right arrows step through years. Current month is highlighted.

**Collapsed view (default) — `ProjectSummaryBar`**  
One bar per project spanning the earliest `createdAt` to the latest `targetDate`. Hovering a month with milestones shows a tooltip with milestone names.

**Expanded view — `MilestoneRow`**  
Individual bars per milestone, colored by status:

| Status | Color |
|---|---|
| `completed` | Green |
| `in-progress` | Blue |
| `planned` | Grey |
| `overdue` | Yellow |
| `unstarted` / `next` | Accent |

**Milestone detail panel** — clicking a milestone opens a panel below the timeline showing all its issues (identifier, title, status badge, priority, labels, assignee, due date, completed date). Clicking an issue card opens `IssueDetailModal`.

### 7.3 Metrics Panel — `MetricsPanel`

**Data:** `GET /issueMetrics/?slug={slug}` → `{ issue_metrics[], cycle_metrics[] }`

**Filters:**
- Project selector (defaults to first project)
- Cycle selector (newest first; selecting a cycle auto-fills the date range)
- Date range (From / To) with a "Clear" link

**Cycle Scope vs Completed — `CycleBarChart`**  
Grouped bar chart: Scope vs Completed per cycle. Shows whether the team consistently completes what they plan.

**Issues by Status — `IssueMetricsView`**  
Stacked area chart showing issue distribution across statuses over time for the selected cycle. Mobile has a collapsible legend.

**Components available but not currently rendered:**  
`CycleHistoryChart`, `CycleTable`, `UncompletedIssuesList` — imported in `metrics-panel.tsx` but not rendered in the current UI.

### 7.4 Data flow

```
User lands on /{slug}/dashboard/roadmap
  ├── GET /roadmap/?slug → milestones flattened → RoadmapTimeline
  └── GET /issueMetrics/?slug → MetricsPanel (CycleBarChart + IssueMetricsView)
```

### 7.5 File Map

| File | Responsibility |
|---|---|
| `app/[slug]/dashboard/(portal)/roadmap/page.tsx` | Main page |
| `components/roadmap/roadmap-timeline.tsx` | Timeline shell + milestone detail panel |
| `components/roadmap/ProjectRow.tsx` | Collapsed / expanded project row toggle |
| `components/roadmap/ProjectSummaryBar.tsx` | Summary bar + MilestoneRow bars |
| `components/roadmap/TimelineHeader.tsx` | Year nav + months header |
| `components/metrics/metrics-panel.tsx` | Metrics filter bar + chart grid |
| `components/metrics/cycle-metrics.tsx` | CycleBarChart + unused chart components |
| `components/metrics/issues-metrics.tsx` | Issues by Status area chart |

---

---

## 8. Documents

> Main page: `app/[slug]/dashboard/(portal)/documents/page.tsx`

### Who sees it

`customer`, `stakeholder`, and `developer`. All three roles have it in the sidebar.

### 8.1 Page Layout

```
┌─────────────────────────┬──────────────┐
│  Project Documents      │  Upload      │
│  (2/3 width)            │  Document    │
└─────────────────────────┴──────────────┘
```

### 8.2 Project Documents — `DocumentsList`

**Data:** `GET /storage?user_id={profile.id}` — all documents the user has access to.

| Field | Purpose |
|---|---|
| `id` | Unique identifier |
| `file_name` | Display name, used to derive file format icon |
| `category` | Reports / Technical / Design |
| `created_at` | Shown as formatted date |
| `size` | File size string |
| `permission` | `"write"` or `"read"` |
| `project_slug` | Groups document under a project folder |

**Search** — real-time text filter on file name (client-side).

**Category filter** — All / Reports / Technical / Design pills.

**Project grouping** — documents grouped by `project_slug`. If 2+ projects, shows collapsible folder headers. If only one project, folders hidden.

### 8.3 Document Row Actions

Actions appear on hover:

| Action | Who | What |
|---|---|---|
| **Open** | Everyone | `GET /storage/download?document_id=...&inline=true` → signed URL → new tab |
| **Download** | Everyone | `GET /storage/download?document_id=...` → signed download URL → new tab |
| **Share** | `write` only | Opens ShareDocumentModal |
| **Category** | `write` only | Popover with category options → `PUT /storage` |
| **Delete** | `write` only | `DELETE /storage` → list refreshes |

### 8.4 Share Document Modal

Comma-separated email input → `POST /storage/share` with `{ document_id, emails[], user_id }`. On success the modal closes.

### 8.5 Upload Document — `UploadDocument`

**Two ways to select:** drag & drop onto the dashed zone, or click to open file picker. Multiple files upload in parallel immediately on selection.

**Per-file status:** uploading spinner → complete checkmark → error X.

**Upload call:** `POST /storage` as `multipart/form-data`:

| Field | Value |
|---|---|
| `file` | Raw file |
| `bucket` | `"documents_bucket"` |
| `path` | `"uploads/{timestamp}-{filename}"` |
| `user_id` | Supabase auth UID |
| `email` | User email |
| `project_slug` | URL `slug` param |

### 8.6 Permission model

| Permission | Open | Download | Share | Change Category | Delete |
|---|---|---|---|---|---|
| `read` | ✅ | ✅ | ✗ | ✗ | ✗ |
| `write` | ✅ | ✅ | ✅ | ✅ | ✅ |

### 8.7 File Map

| File | Responsibility |
|---|---|
| `app/[slug]/dashboard/(portal)/documents/page.tsx` | Page shell |
| `components/documents/documents-list.tsx` | Document list with search, filter, grouping |
| `components/documents/document-list-panel.tsx` | Document rows with all actions |
| `components/documents/ShareDocumentModal.tsx` | Share modal |
| `components/documents/upload-document.tsx` | Upload panel |
| `components/documents/update-document-entry.ts` | `useUpdateDocument` + `useDeleteDocument` mutations |

---

---

## 9. Chat

> Main page: `app/[slug]/dashboard/(portal)/chat/page.tsx` → `CometChatPage`

### Who sees it

`customer`, `developer`, `stakeholder`, and `admin`.

Two distinct chat surfaces exist:
- **This page** — full standalone chat with a sidebar and conversation view.
- **Issue Chat** (`IssueCometChat`) — the Chat tab inside the Issue Detail Modal, scoped to one issue (see Issue Flows section).

### 9.1 CometChat Initialization — `useCometChat`

On every page load:

1. `CometChat.init(APP_ID, settings)` — initialise SDK.
2. `supabase.auth.getUser()` — get the Supabase UID.
3. Login to CometChat using the Supabase UID:
   - Already logged in as same user → reuse session.
   - Logged in as different user → logout, then login.
   - UID not found in CometChat → auto-create user (name = email), then login.
4. Fetch all joined groups (admins fetch all groups, no filter).
5. `ready = true` → UI renders.

### 9.2 Page Layout — `ChatLayout`

Two-panel split: sidebar (left) + chat area (right).

**Mobile:** one panel at a time. Sidebar by default; selecting a chat hides it. A "Back to chats" button returns to the sidebar.

**Auto-open `CreateChatModal`** when `ready` fires if:
- URL has `?newChat={title}` (navigated from an issue card), OR
- User is a customer with no groups and no direct chats.

### 9.3 Sidebar — `ChatSideBar`

**Group chats** — rows with avatar (initials), group name, member count. If groups span multiple `projectSlug` values (from group metadata), they are grouped into collapsible sections by project. Hover on any row shows ✕ to hide that chat from the local view (does not delete the CometChat group).

**Direct chats (AI Agent)** — conversations with AI agents, shown with a bot icon and "AI Agent" subtitle.

**New Chat button** — always at the bottom of the sidebar; also in the header for customers only.

### 9.4 Creating a Group Chat — `CreateChatModal`

User types a title and clicks Create. `createSupportGroup(title, projectSlug)` assembles members automatically:

**If customer:**
1. `GET /assignments?customer_id={profile.id}` → fetch all assigned developers + stakeholders.
2. Add them all as group members.

**If stakeholder:**
1. `GET /assignments?developer={profile.id}` → find the assigned customer.
2. `GET /assignments?customer_id={customerId}&onlyDev=true` → find developers.
3. Add customer + developers as members.

For any UID not yet in CometChat → `CometChat.createUser()` is called first. Group GUID: `customer_{profile.id}_{timestamp}`. Metadata includes `{ projectSlug }` for sidebar grouping.

### 9.5 Opening chat from an issue card

```
/acme/dashboard/client  →  /acme/dashboard/chat?newChat=SPA-42%20Issue%20title
```

The `?newChat` param pre-fills the modal title and opens it automatically.

### 9.6 Data flow

```
User lands on /{slug}/dashboard/chat
  ├── CometChat.init
  ├── supabase.auth.getUser → resolve UID
  ├── CometChat.login (auto-create user if missing)
  ├── fetchGroups (joined-only, unless admin)
  ├── ready = true → UI renders
  ├── if ?newChat OR (customer with no chats) → CreateChatModal auto-opens
  └── User selects group → GroupChat renders with real-time listener
```

### 9.7 File Map

| File | Responsibility |
|---|---|
| `app/[slug]/dashboard/(portal)/chat/page.tsx` | Page entry — reads `?newChat` param |
| `components/chat/CometChat/ChatLayout.tsx` | Two-panel layout, selection state, auto-open logic |
| `components/chat/CometChat/ChatSideBar.tsx` | Sidebar — groups, direct chats, projectSlug grouping |
| `components/chat/CometChat/useCometChat.ts` | SDK init, login, group fetch, group creation |
| `components/chat/CometChat/CreateChatModal.tsx` | New chat modal |
| `components/chat/CometChat/GroupChat.tsx` | Group conversation view |
| `components/chat/CometChat/DirectChat.tsx` | AI agent direct conversation |
| `components/chat/CometChat/IssueCometChat.tsx` | Embedded issue chat (used in IssueDetailModal) |
| `components/chat/CometChat/constants.ts` | APP_ID, REGION, AUTH_KEY |

---

---

## 10. Settings

> Main page: `app/[slug]/dashboard/(portal)/settings/page.tsx`

### Who sees it

`customer` via their sidebar. `admin` when viewing a specific customer's panel.

### Admin viewing a customer's settings

`CustomerSlugContext` provides the customer slug. `SettingsTabs` detects this and fetches the customer list to resolve the correct `userId` and `customer_id` (Stripe ID) for that customer, so the admin sees the same data the customer would.

### 10.1 Tab structure

| Tab | Content |
|---|---|
| **Staffing** *(default)* | The team assigned to this customer |
| **Billing** | Stripe subscription, invoices, and payment method |

> A `"documents"` tab case exists in the code but has no tab button — it is unreachable in the current UI.

### 10.2 Staffing Tab

**Data:** `GET /assignments?customer_id={userId}` → all assigned developers and stakeholders.

Each team member card shows: avatar (initials), name, email, role badge (always "active"), join date, weekly hours (`allocation`).

**Request Change button** — opens a Cal.com booking link in a new tab, pre-filled with the first assigned developer's email. Lets the customer book a call to request staffing changes.

### 10.3 Billing Tab

**Data:** `GET /stripe/client?customer_id={stripeCustomerId}` — full Stripe snapshot:

| Field | Content |
|---|---|
| `subscription` | Stripe subscription (including `status`) |
| `upcomingInvoice` | Next scheduled invoice date and amount |
| `invoices[]` | Historical invoice list |
| `paymentMethod` | Card brand, last 4, expiry |

**Outstanding Balance — `PendingBalancePanel`**  
Sum of `amountDue - amountPaid` across all invoices. Green if zero, warning yellow if positive.

**Next Invoice — `NextPaymentPanel`**
- Active subscription → shows next date and estimated amount.
- Canceled subscription → "Subscription canceled" message + **Renew Subscription** button → Stripe Customer Portal.
- No upcoming invoice → "No upcoming invoice scheduled."

**Invoice History — `InvoicesPanel`**  
Lists invoices with date, amount, and status badge (paid=green, open=yellow, void=grey, failed=red). Shows 5 by default with a "Show all N invoices" toggle. Each invoice with a PDF has a download button.

**Payment Method — `PaymentMethodPanel`**  
Shows card brand, last 4 digits, expiry. "Add Card" or "Update Card" button calls `POST /stripe/create-customer-portal` → Stripe-hosted portal URL opened in new tab.

### 10.4 Data flow

```
User lands on /{slug}/dashboard/settings
  ├── if admin viewing customer:
  │     GET /users?type=customers → resolve effectiveUserId + effectiveCustomerId
  ├── GET /stripe/client?customer_id → billing data
  ├── Staffing tab (default):
  │     GET /assignments?customer_id → team members
  └── Billing tab:
        PendingBalance + NextPayment + Invoices + PaymentMethod
```

### 10.5 File Map

| File | Responsibility |
|---|---|
| `app/[slug]/dashboard/(portal)/settings/page.tsx` | Page shell |
| `components/settings/settings-tabs.tsx` | Tab switcher, ID resolution for admin |
| `components/settings/staffing-section.tsx` | Team list + Cal.com button |
| `components/settings/billing-section.tsx` | Billing layout — assembles all panels |
| `components/settings/billing-panels/pending-balance.tsx` | Outstanding balance |
| `components/settings/billing-panels/next-payment-panel.tsx` | Next invoice + canceled state |
| `components/settings/billing-panels/invoices-panel.tsx` | Invoice history |
| `components/settings/billing-panels/payment-method-expand.tsx` | Card display + Stripe portal redirect |
| `context/CustomerSlugContext.tsx` | Customer slug for admin preview |

---

---

## 11. Environments & Schema Routing

There is a single schema, **`portal`**, used everywhere — local dev and production alike. The old `portal`/`portaldev` split (and the `x-portal-schema` header / `resolvePortalSchema` mechanism that picked between them) has been removed entirely; `supabase/functions/utils/schema.ts` no longer exists, and `.env.development.local` (which used to set `NEXT_PUBLIC_SUPABASE_SCHEMA="portaldev"`) has been deleted.

- `supabase/functions/*/index.ts` — every edge function hardcodes `const schema = "portal";` right after parsing the request, threaded down into every handler.
- Components that query Supabase directly with the anon key (not through an edge function) — `use-issue-update-badge.ts`, `use-document-requests.ts`, `use-pinned-panels.ts`, `issue-detail-modal.tsx`, `set-password/page.tsx` — call `supabase.schema("portal").from(...)` directly; there is no more `PORTAL_SCHEMA` export from `lib/supabase-client.ts`.
- `lib/api-headers.ts` (`API_HEADERS`/`API_JSON_HEADERS`, used for edge-function `fetch()` calls) no longer attaches an `x-portal-schema` header.

When creating new tables (e.g. `services`/`diagrams`, see [section 4.6](#46-design-tab--services--diagrams)), they only need to exist in the `portal` schema now.

### 11.1 File Map

| File | Responsibility |
|---|---|
| `lib/supabase-client.ts` | Anon-key Supabase client (`supabase`); no longer exports a schema constant |
| `lib/api-headers.ts` | `API_HEADERS`/`API_JSON_HEADERS` for edge-function requests — no schema header |
| `supabase/functions/client.ts` | Service-role Supabase client shared by all edge functions (bypasses RLS) |
| `supabase/functions/*/index.ts` | Each hardcodes `const schema = "portal";` |
