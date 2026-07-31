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
- Access the **Admin Panel** (`/users`) to create and manage all other users (developers, customers, stakeholders).
- Assign developers and stakeholders to customers.
- Preview any customer's full portal (Dashboard, Roadmap, Documents, Chat, Settings) via the Dashboards view.
- Ask questions on issues (same permissions as developers). Cannot change issue state directly (see 4.2).

**Sidebar:** Users, Dashboards, Chat

---

### Developer

**How accounts are created:** Admin creates them via the **Add Developer** button in the Admin Panel. The developer receives an invitation email with a link to set their password and complete their profile at `/set-password`.

**What they can do:**
- View all active issues across their assigned customers.
- Ask questions on issues (Decisions tab) and submit them to the client.
- Cannot change issue state directly — state only advances via the client's Business Review/UAT actions or QA test recording (see 4.2, 4.3).
- Create and manage test cases.
- Upload and view documents.
- Must agree to company policies on first login (Policy Approval Modal).

**Sidebar:** Developer, Chat, Documents

---

### Customer

**How accounts are created:** Admin creates them via the **Add Customer** button in the Admin Panel — requires email, Stripe Customer ID, and Linear Slug. The customer receives an invitation email.

**What they can do:**
- View their project's active issues in two focused lists: Business Review (needs approval) and UAT (needs testing).
- Complete Business Review once every question has an answer, moving the issue to Development.
- Record a UAT outcome — "Approved" (→ Done) or "Fixes Required" (→ back to QA).
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
- Can approve tests, answer decisions, record UAT results, complete Business Review, and record a UAT outcome — same as Customer above.
- Can also reopen a `Done` issue back to `Development`.
- Cannot access Settings (no billing or staffing panels).
- Typically a secondary contact on the client side who reviews and approves but is not the primary account owner.

**Sidebar:** Dashboard, Roadmap, Documents, Chat

---

### Permissions at a glance

| Action | Admin | Developer | Customer | Stakeholder |
|---|---|---|---|---|
| Create users | ✅ | ✗ | ✗ | ✗ |
| Assign developers to customers | ✅ | ✗ | ✗ | ✗ |
| Ask questions (Decisions tab) | ✅ | ✅ | ✗ | ✗ |
| Answer questions / submit decisions | ✗ | ✗ | ✅ | ✅ |
| Complete Business Review (→ Development) | ✗ | ✗ | ✅ | ✅ |
| Record UAT outcome (Approved → Done / Fixes Required → QA) | ✗ | ✗ | ✅ | ✅ |
| Reopen a `Done` issue (→ Development) | ✗ | ✗ | ✗ | ✅ |
| Approve test cases | ✗ | ✗ | ✅ | ✅ |
| Record UAT results | ✗ | ✗ | ✅ | ✅ |
| Create test cases | ✅ | ✗ | ✗ | ✗ |
| Upload documents | ✅ | ✅ | ✅ | ✅ |
| View billing & staffing (Settings) | ✅ | ✗ | ✅ | ✗ |
| Preview any customer's dashboard | ✅ | ✗ | ✗ | ✗ |

> These permissions are derived from `profile.role` (UserContext) and evaluated as `canAnswer` (customer/stakeholder) and `canAsk` (developer/admin) inside `IssueDetailModal`. Admin/Developer no longer have any way to change issue state from this modal — that capability was removed along with the generic "Move to `<next state>`" button.

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
| `admin` | `/admin/users` | Always |
| `customer` | `/{clientName}/dashboard` | Always |
| `developer` | `/dev/developer` | Always |
| `stakeholder` | `/{assignment[0].clientName}/dashboard` | Requires at least one customer assignment |

> **Important:** Stakeholders with no assignment cannot log in — they see "No client assigned to this account. Contact your administrator." The admin must assign them to a customer first (see Admin Panel section).

**Admin and developer routes carry no customer slug at all** — fixed paths (`/admin/*`, `/dev/*`) rather than `/{slug}/*`, since neither role is tied to a single customer. Customer/stakeholder routes stay slug-based.

> **Admin/developer redirect history:** admin's redirect used to be slug-based too — first `/{clientName}/admin` (broken: `clientName` only populates when a user has a `customer_id`, which admins never do, so it always resolved to `/null/admin`), then `userName` as a stand-in slug (`/{userName}/users`, requiring every admin account to have a `userName` set). Developer's redirect was similarly `/{assignment[0].clientName}/developer`. Both were replaced by the fixed, slug-less routes above — `app/admin/users/page.tsx` and `app/dev/developer/page.tsx` (a thin wrapper re-exporting the same `DeveloperDashboard` that used to live only under `app/[slug]/(portal)/developer/page.tsx`).

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
| `customer` | `/{clientName}/dashboards/{clientName}/dashboard` |
| Everyone else | `/{clientName}/dashboards` |

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

There's no top-right action-button row anymore — each role gets its own **"Add {role}"** button at the bottom of that role's section in the Users view. No "Add Admin" flow exists (admins are created directly in Supabase Auth).

### 3.1 Users View

`GET /users` loads once on mount. Rather than one filterable list, the view renders **four always-visible cards**, one per role (Admin/Developer/Customer/Stakeholder) — each showing only that role's matching users. **No colored role badge** (the card already conveys it), and **no role-filter pills** — the single text-search box (email/username, client-side) is the only filter, narrowing all four cards at once.

Row actions: **View Profile** (hover, developers only), **Edit Profile** (hover, developers only), **Assign** (hover, developers/stakeholders only), a **Resend account email** dropdown (always visible, every role — "Resend invite" / "Send password reset", `POST /users?type=resend-account-email`, never touches `users`/`customers`), and an **Expand arrow** (developers only).

**Expanding a user** is developer-only now — clicking the arrow on a developer row shows their assigned customers (join date, weekly hours) via `GET /assignments?developer={id}`, loaded on demand. Customers and stakeholders have no expand affordance here.

### 3.2 Projects View

Same assignment data, organized from the customer's perspective. Each block lists everyone assigned to that customer — **customer first, then stakeholders, then developers**. `GET /assignments?customer_id=id1,id2,...` actually fires as soon as the customer list resolves, not gated behind switching to this view.

### 3.3 Add Developer — `AddDeveloperModal`

| Field | Required | Notes |
|---|---|---|
| Email | ✅ Yes | Login identifier |
| First name | No | |
| Last name | No | |
| Username | No | Sent as `clientName` |
| Phone number | No | |
| Developer Type | ✅ Yes (defaults to Spark & Co FDE) | Toggle: **Spark & Co FDE** or **Internal** |
| Rate amount + Rate type | Only shown/required when **Internal** | Hourly / Monthly / Annual |

**Spark & Co FDE** developers are billed to customers through their (manual) Stripe subscription — unchanged. **Internal** developers are not customer-billed; instead the admin records an internal `rate_amount`/`rate_type` on the developer's `portal.developers` row, for reference only — nothing currently computes billing from it.

Calls `POST /users?type=developer` with `developerType` and, for internal developers, `rateAmount`/`rateType`. `createUser.ts` upserts these onto `portal.developers` right after creating the `users` row (same table `bio`/`tech_stack` live on — §3.8 — but Developer Type/Rate are creation-time only, not yet editable from Edit Profile). The `origin` field (portal URL) is used by the backend to build the invitation email link. On success the user list refreshes.

### 3.4 Add Customer — `AddClientModal`

| Field | Required | Notes |
|---|---|---|
| Client name | ✅ Yes | Sent as `clientName` — display name seen by developers |
| Email | ✅ Yes | |
| Linear Slug | ✅ Yes | Identifies the customer's Linear workspace |
| First name | No | |
| Last name | No | |
| Phone number | No | |
| Stripe Customer ID | No | Sent as `customer_id` only if non-empty — can be added later; billing isn't set up at creation time |

> "Create" is disabled until Client name, Email, and Linear Slug are filled. **Stripe Customer ID is optional** (changed from an earlier required version). `linear_slug` is critical — without it the customer won't see issues and the team can't create requests.

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

### 3.7 View Developer Profile — `ViewDeveloperProfileModal`

Opened via the **View Profile** hover button on any `developer` row, to the left of Edit Profile. Renders the exact same `DeveloperDetailsModal` popup customers see on the Staffing tab (§10.2), so admins can preview a developer's card without leaving the Users list.

`GET /users?type=developer-profile&userId={id}` loads `bio`/`tech_stack`; name/email/role come from the row already in memory. No `joined` date is shown, since this view isn't scoped to a specific customer assignment.

### 3.8 Edit Developer Profile — `EditDeveloperProfileModal`

Opened via the **Edit Profile** hover button on any `developer` row (not shown for other roles). Lets an admin set the **bio** and **tech stack** shown on that developer's Staffing card popup (§10.2).

These fields live on `portal.developers`, not `portal.users`, and are **not** part of the Add Developer flow — the row may not exist yet, so saving upserts it.

1. On open: `GET /users?type=developer-profile&userId={id}` loads current `bio`/`tech_stack`.
2. Edit bio (textarea) and tech stack via the shared `TechStackPicker` (`components/shared/tech-stack-picker.tsx`) — type + Enter/`,` to add a plate/chip, click `×` to remove, drag a chip by its grip handle to reorder (same `@dnd-kit` sortable mechanism as the Steps editor in the issue detail modal's Tests tab, laid out as a wrapping row of pills). The same picker is used by the customer-facing Add Developer modal (§10.2).
3. **Save Changes** → `PATCH /users?type=developer-profile` with `{ userId, bio, tech_stack }`, upserted onto `portal.developers` keyed by `user_id`.

On success, the `developer-profile` and `assignments` queries are invalidated (so any open Staffing view picks up the change) and the modal closes.

### 3.9 Receiving a Spark & Co FDE Developer Request

Customers can request a Spark & Co FDE developer from their own Staffing tab (§10.2 → Add Developer → Spark & Co FDE). That flow creates no user/assignment — it's a notification only: `POST /developer-requests` emails every `role: "admin"` user (role needed, weekly hours, notes, requesting customer).

**To fulfill it:** Admin Panel → `Add Developer` (defaults to `spark_fde` type) → hover the new row → `Assign` → pick the requesting customer and set weekly hours.

### 3.10 Full Onboarding Flow

```
1. Create the Customer           → client name + email + Linear slug required (Stripe ID optional)
2. Create the Developers         → email only required
3. (Optional) Create Stakeholders
4. Assign each Developer         → Users list → hover → Assign → select customer + hours
5. (Optional) Assign Stakeholders → same flow, no allocation
6. Verify in Projects view       → customer block shows all assignees
```

### 3.11 API Endpoints

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
| Get a developer's bio/tech stack | GET | `/users?type=developer-profile&userId={id}` |
| Update a developer's bio/tech stack | PATCH | `/users?type=developer-profile` |
| Resend a user's invite or password-reset email | POST | `/users?type=resend-account-email` |
| Request a Spark & Co FDE developer (customer-only, emails all admins) | POST | `/developer-requests` |

### 3.12 File Map

| File | Responsibility |
|---|---|
| `app/admin/users/page.tsx` | Main page — Users and Projects views |
| `app/admin/users/AddDeveloperModal.tsx` | Modal to create a developer |
| `app/admin/users/AddClientModal.tsx` | Modal to create a customer |
| `app/admin/users/AddStakeholderModal.tsx` | Modal to create a stakeholder |
| `app/admin/users/AssignCustomerModal.tsx` | Modal to assign developer/stakeholder to a customer |
| `app/admin/users/EditDeveloperProfileModal.tsx` | Modal to edit a developer's bio and tech stack |
| `app/admin/users/ViewDeveloperProfileModal.tsx` | Fetches a developer's bio/tech stack and renders the same popup shown on the Staffing tab |
| `components/settings/developer-details-modal.tsx` | Shared popup component — used from both Staffing (customer view) and the admin View Profile action |
| `components/shared/tech-stack-picker.tsx` | Shared drag-to-reorder tech stack chip editor |
| `supabase/functions/users/resendAccountEmail.ts` | Resends a user's invite/password-reset email without touching `users`/`customers` |
| `supabase/functions/developer-requests/` | Edge function — emails all admins when a customer requests a Spark & Co FDE developer |
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

Defined in `STATUS_ORDER` (`components/client/issues.types.ts`) — used for sorting/ordering elsewhere in the app. The Description tab has no generic "advance to next state" control; Admin/Developer cannot advance state from the Issue Detail Modal at all. State only changes at these specific points, gated to `canAnswer` (customer/stakeholder):

- **Business Review → Development**: a **"Complete Review"** button appears once every question in the Decisions tab has an answer (or none were asked yet — `reviewComplete`).
- **UAT → Done / QA**: two buttons appear while the issue is in UAT — **"Approved"** (→ `Done`) and **"Fixes Required"** (→ back to `QA`).
- **Done → Development**: Stakeholders only can reopen a completed issue via "Move back to Development" (`canReopenFromDone`).

All of the above call `PATCH /issues` with `{ issueId, stateName }`.

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

Each issue has its own CometChat group, keyed to a deterministic GUID (`issue_{issueId}`) — but created **lazily**. On open, the tab only looks up whether that group already exists; it doesn't create one or add members just for viewing. The group is created on the **first message sent**, with members resolved from the sender's role and a "Creating chat and adding users…" loader shown meanwhile. Once a group exists, it behaves like any other group chat (real-time listener, join-on-view, 50-message history). Full detail in `app/docs/CHAT_FLOWS.md` → "Issue Chat".

Messages show user initials avatars, sender name, and timestamp. The list auto-scrolls to the latest message.

### 4.6 Design Tab — Services & Diagrams

**Where:** Design tab inside the Issue Detail Modal (`issue-detail-modal.tsx` → `DesignTab`).

> Both **Design** and **Demo** (4.6b below) are hidden for Bug issues (`isBugIssue`, derived from a "bug" label on the issue) — the tab bar only shows Description / Chat / Tests / Decisions for those.

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

### 4.6b Demo Tab — Video Walkthroughs

**Where:** Demo tab inside the Issue Detail Modal (`issue-detail-modal.tsx` → `DemoTab`). Hidden for Bug issues (same `isBugIssue` gate as Design).

A demo is a **versioned** record per issue (`portal.demo_videos`, `UNIQUE(issue_id, version)`) — v1, v2, v3, … Each version is either an **uploaded video file** or an **embed link** (e.g. Loom), tracked via `source_type: "upload" | "embed"`, and has its own **feedback thread** (`portal.demo_video_comments`) shared across every role.

**Adding a brand-new version (v{n} → v{n+1}):**
1. **"Upload demo" / "Upload new version"** → file picker (`accept="video/*"`) → `POST /demo-videos` (`multipart/form-data`) with `file`, `issue_id`, `email`. Validated against a video MIME whitelist and a 500 MB cap, stored at `{issueId}/v{n}/{uuid}{ext}` in the private `demo-videos` bucket.
2. **"Add embed link"** → URL input → `POST /demo-videos` (JSON) with `issue_id`, `email`, `embed_url` (must be `https`).
3. Either path computes the next version as `max(version) + 1` for that issue; a race on the same version number fails cleanly off the `UNIQUE(issue_id, version)` constraint rather than silently colliding.

**Replacing the currently-selected version's content (version number unchanged):**
1. **"Replace v{n} with file"** → `PUT /demo-videos` (multipart) with `demo_id`, `email`, `file`.
2. **"Replace v{n} with link"** → `PUT /demo-videos` (JSON) with `demo_id`, `email`, `embed_url`.
3. Either way the new content is written first, then the old Storage object is deleted afterward — but only if the version being replaced was itself an upload.

**Playback:** uploads get a fresh 1-hour signed URL on every `GET` (private bucket, no public URLs). Embeds render in an `<iframe>`; Loom share links (`loom.com/share/{id}`) are rewritten to the embeddable `loom.com/embed/{id}` form, other providers embed as-is.

**Feedback:** scoped to `demo_video_id`, not the issue — switching the Version dropdown switches which thread is shown. Anyone posts via `POST /demo-videos?type=comments` with `{ demo_video_id, email, body }`.

### 4.7 File Map

| File | Responsibility |
|---|---|
| `components/shared/create-issue.tsx` | Create Issue dialog (all types) |
| `components/client/issues.types.ts` | Shared types, color maps, STATUS_ORDER |
| `components/client/issue-detail-modal.tsx` | Modal shell + Description / Decisions / Tests / Design / Demo tabs; owns `isBugIssue` gating |
| `components/client/issue-cards.tsx` | IssueCard (grid view) and IssueListRow (compact view) |
| `components/client/priority-tasks.tsx` | Main issue list with filters and search |
| `components/chat/CometChat/IssueCometChat.tsx` | Per-issue real-time chat |
| `components/client/design-tab.tsx` | Design tab — service/version dropdowns, Mermaid upload, and SVG renderer |
| `supabase/functions/diagrams/index.ts` | Router — `GET`/`POST` for diagrams |
| `supabase/functions/diagrams/listDiagrams.ts` | Services-with-diagrams, version history by service, or diagrams by issue |
| `supabase/functions/diagrams/createDiagram.ts` | Uploads a `.mmd` to `diagrams_bucket` and inserts the `diagrams` row |
| `supabase/functions/diagrams/createService.ts` | Inserts a new `services` row (only called for "crear nuevo") |
| `supabase/functions/diagrams/getService.ts` | Fetches an existing `services` row, scoped to `project_slug` |
| `components/client/demo-tab.tsx` | Demo tab — version picker, upload/embed forms (new version + replace-in-place), player, per-version feedback |
| `supabase/functions/demo-videos/index.ts` | Router — `GET`/`POST`/`PUT` for demo videos and their comments |
| `supabase/functions/demo-videos/createDemoVideo.ts` | Adds a new version from an upload or an embed link |
| `supabase/functions/demo-videos/updateDemoVideo.ts` | Replaces an existing version's content in place, cleaning up the old storage object if needed |
| `supabase/functions/demo-videos/listDemoVideos.ts` | Lists all versions for an issue with freshly signed playback URLs |
| `supabase/functions/demo-videos/listComments.ts` / `createComment.ts` | Per-version feedback thread CRUD |
| `supabase/functions/demo-videos/helpers.ts` | Video/embed-URL validation, signed URL helper, `SCHEMA`/`BUCKET` constants |

---

---

## 5. Client Dashboard

> Main page: `app/[slug]/(portal)/dashboard/page.tsx` → `ClientDashboard`

### Who sees it

Users with `role === "customer"` or `role === "stakeholder"` after login. URL: `/{clientName}/dashboard`.

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
| Deploy Frequency | Count of `feat/`/`fix/` merges whose squash commit is confirmed reachable on `main` (last 30/90 days) |
| Lead Time for Changes | Avg hours from branch creation to squash-merge, `feat/` branches only |
| MTTR | Avg hours from branch creation to squash-merge, `fix/` branches only (not incident-recovery time, despite the classic DORA name) |
| Change Failure Rate | % of non-hotfix deployments immediately followed by a hotfix deployment |

**How DORA metrics are calculated** (`supabase/functions/dora/`)

All four metrics are computed from Git branch and commit history via the GitHub API (`base=main`) — **no GitHub issues are used anywhere in this flow.** Full internal pipeline: `supabase/functions/dora/diagrams/dora-flow.mmd`.

**Lead Time for Changes** (`leadTime.ts`) and **MTTR** (`mttr.ts`) share the same join logic in `lifecycle.ts`. A PR only qualifies if its **title** (`pr.title`, not `pr.head.ref`) starts with `feat/` (Lead Time) or `fix/` (MTTR) and contains a Linear id, e.g. `feat/SPA-123-add-login`. It's checked against the title specifically because every PR here is opened staging→main, so `pr.head.ref` is always the literal string `"staging"` and carries no branch identity — the convention that makes title-matching work is that the original working branch is created with the same name that later becomes the PR title:

- **Dev start** (`branch_created_at`) comes from `portal.dora_branch_events`, populated by the `github-webhook` function (GitHub `create` event) or, when no webhook is registered on the repo, by `dora/events.ts` polling `GET /repos/{repo}/events` for `CreateEvent`s. If neither caught it (event window expired, or it predates both), it falls back to the earliest commit's author date on the PR — marked `dev_start_source: "first_commit_fallback"` in the raw result.
- **Dev completion** is the merge timestamp, counted only once `isSquashMergeForPR` confirms the merge commit has exactly one parent and a SHA not matching any of the PR's own commits (rules out regular merge commits and rebases).
- The metric is `dev_completed_at - branch_created_at` in hours, averaged across all qualifying branches of that type.

Branches without a `feat/`/`fix/` prefix, without a parseable Linear id, or whose merge doesn't look like a squash, are excluded — the card shows `null` for that metric if nothing qualifies.

**Deploy Frequency** (`deployFreq.ts`) uses the same `feat/`/`fix/` branch-name qualification, then confirms via GitHub's compare API (`GET /repos/{repo}/compare/main...{sha}`) that the squash commit is reachable on `main`. There is no CI-status gate. Each deployment record carries `linear_issue_id`/`branch_type` for traceability.

**Change Failure Rate** (`cfr.ts`) is the one metric still based on **all** merged PRs (not just `feat/`/`fix/`) and on PR title/commits rather than a qualifying branch prefix — unchanged by the Git-history migration. A PR is a "hotfix" if its title, labels, or commit messages start with one of `ERROR_SIGNALS` in `supabase/functions/dora/github.ts` (`revert`, `hotfix`, `rollback`, `bugfix`, `fix/`, `fix:`), or the title matches `fix: SPA-<id>`, **or** the title itself is a qualifying `fix/`-type title (`parseQualifyingBranch(pr.title)?.type === "fix"` — added once `fix/` PRs became first-class qualifying work for the other three metrics, so CFR still counts them as "reactive work" even without any other hotfix signal). A non-hotfix deployment counts as "failed" if the next chronological deployment is a hotfix.

**How `dora` gets triggered & how metrics accumulate over time**

`dora` runs on its **own cron**, independent of `issueMetrics` — `POST /dora { method: "allCustomers" }` → `handleAllCustomers`, iterating every customer with a `linear_slug` and non-empty `project_url`. This is deliberate: GitHub's API is slower/more rate-limited than Linear's, so it shouldn't share a run or timeout budget with Linear-only metrics. `issueMetrics/index.ts` no longer triggers `dora` at the end of its own run (an older comment to that effect still lives in `supabase/functions/users/createCustomerFlow.ts`, but the code it describes is gone) — so creating a new customer today only kicks off `issueMetrics` immediately; that customer's DORA numbers populate on the next scheduled `dora` cron run, not instantly. Each `dora` run starts by polling GitHub's events feed (`pollBranchCreationEvents`) before computing the four metrics.

**Since-window, per customer:** each run looks back at least 90 days (`MIN_LOOKBACK_DAYS`), extending further back if that customer's stored `dora_metrics.last_called` is older than 90 days — the window self-heals to cover however long it's actually been since that customer last ran successfully, rather than trusting a fixed short window that could silently and permanently drop merges from a missed run.

- **Change Failure Rate** is recomputed from scratch on every run — it always re-fetches the most recent `limit` merged PRs (default 100, no date filter), so it's a sliding window over PR history, not a cumulative store.
- **Lead Time, MTTR, and Deploy Frequency** are cumulative and stored in `dora_metrics`. Each run only fetches PRs merged within the since-window above and appends new, deduped entries (by `pr_number`) to the existing lists — it never overwrites or drops old entries, so the averages reflect *all* accumulated samples, not just the current run's window.

**Business Review — `PriorityTasks` (Business Review)**  
Issues in Business Review state, sorted by unanswered question count. Client reviews and approves user stories here.

**Acceptance Testing — `PriorityTasks` (UAT)**  
Issues in UAT state, sorted by question count. Client records test results here.

### 5.4 Opening chat from a card

The chat icon on each card (hover to reveal) navigates to the chat page with the issue pre-selected:

```
/acme/dashboard  →  /acme/chat?newChat=SPA-42%20Issue%20title
```

### 5.5 Data flow

```
User lands on /{slug}/dashboard
  ├── AuthGate → session check
  ├── GET /issues?slug  → allIssues, businessReviewIssues, uatIssues
  ├── GET /decisions/counts  (refetches every 30s)
  └── GET /get-dora-metrics
```

### 5.6 File Map

| File | Responsibility |
|---|---|
| `app/[slug]/(portal)/dashboard/page.tsx` | Main client dashboard page |
| `app/[slug]/(portal)/layout.tsx` | Shared layout — AuthGate, Sidebar, ConsentProvider |
| `components/client/progress-pie-chart.tsx` | Project Stats donut chart |
| `components/roadmap/software-kpis.tsx` | DORA Metrics card |
| `components/client/priority-tasks.tsx` | Issue list (Business Review + Acceptance Testing) |
| `components/client/issue-detail-modal.tsx` | Issue detail modal |
| `components/client/request-project-dialog.tsx` | "New project Request" dialog — emails admins instead of creating in Linear |
| `supabase/functions/project-requests/createProjectRequest.ts` | Looks up `role === "admin"` users and triggers the notification email |
| `supabase/functions/project-requests/sendProjectRequestMail.ts` | Resend email template for project requests |

---

---

## 6. Developer Dashboard

> Main page: `app/dev/developer/page.tsx` → re-exports `DeveloperDashboard` (the component itself lives at `app/[slug]/(portal)/developer/page.tsx`)

### Who sees it

Users with `role === "developer"` after login, at the fixed route **`/dev/developer`** — no customer slug, since a developer isn't tied to one customer (unlike customer/stakeholder, whose routes stay `/{clientName}/...`).

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
User lands on /dev/developer
  ├── AuthGate → session check (app/dev/layout.tsx also redirects home if role !== "developer")
  ├── profile.assignment_id[] → projects list
  ├── Promise.all → GET /issues per customer (parallel)
  ├── GET /decisions/counts  (refetches every 30s)
  └── GET /agreePolicies/check
        → if false → PolicyApprovalModal (blocking)
```

### 6.7 File Map

| File | Responsibility |
|---|---|
| `app/[slug]/(portal)/developer/page.tsx` | Main developer dashboard |
| `components/developer/quick-links.tsx` | Quick Links card |
| `components/developer/tool-shortcuts.tsx` | Tool Shortcuts card |
| `components/client/priority-tasks.tsx` | Issue list with filter/sort |
| `components/ui/PolicyApprovalModal.tsx` | Blocking policy agreement modal |

---

---

## 7. Roadmap

> Main page: `app/[slug]/(portal)/monitor/page.tsx` → `RoadmapPage`

### Who sees it

`customer`, `stakeholder`, and `admin` (when previewing a customer). Not in the developer sidebar.

### 7.1 Data loaded on mount

Three independent fetches: `GET /issues?slug=` (feeds `ProgressPieChart`/"Project Stats", same as the Client Dashboard — not merged with the data below), `GET /roadmap/?slug={slug}` (initiative + projects + milestones, **plus the initiative's team-wide cycle list**), and `GET /issueMetrics/?slug=` (7.4). A fourth, `GET /roadmap?cycleId=`, fires on demand when a cycle cell is clicked (7.3), not on mount.

```
{
  initiative: { id, projects: { nodes: [
    { name, targetDate, createdAt, currentProgress, progress, ...,
      projectMilestones: { nodes: [
        { name, status, progress, targetDate, createdAt,
          currentProgress { scopeCount, scopeEstimate, ... },
          issues: { nodes: [ /* first 25 only */ ], pageInfo } }
      ] } }
  ] } },
  cycles: { nodes: [ { id, number, name, startsAt, endsAt, isActive } ], pageInfo }
}
```

`cycles` is resolved separately (cycles belong to a **team**, not a project — the backend looks up the first project's team, then that team's cycles) and is what drives the Projects Timeline's columns (7.3) — an axis independent of the milestones' own dates. A `useEffect` flattens all milestones into `allMilestones[]`, injecting `projectName` onto each, and builds a `projectIdsByName` map used by the cycle drill-down.

### 7.2 Software KPIs (DORA Metrics) — `SoftwareKPIs`

**Data:** `GET /get-dora-metrics?linear_name={slug}` → cached row from `portal.dora_metrics`.

Four tiles from `averages`: **Change Failure Rate**, **Lead Time for Changes** (`feat/` branches), **Mean Time to Restore** (`fix/` branches), **Deploy Frequency** (last 30/90 days).

All of it is derived from Git branch/commit history in the `dora` edge function — **no GitHub issues involved**. A PR only qualifies if its **title** (not `pr.head.ref`, which is always `"staging"` here since every PR is opened staging→main) starts with `feat/` or `fix/` and contains a Linear id. Dev start = branch creation (webhook, or a GitHub-events poll / first-commit-date fallback when no webhook is registered); dev completion = confirmed squash merge; deployment = squash commit confirmed reachable on `main`. Runs on its own cron, decoupled from `issueMetrics` (see 5.3 for the since-window/accumulation details). Full pipeline: [supabase/functions/dora/diagrams/dora-flow.mmd](../supabase/functions/dora/diagrams/dora-flow.mmd).

### 7.3 Projects Timeline — `RoadmapTimeline`

Rebuilt around Linear **cycles**, not calendar months — no more year-at-a-glance view.

**Cycle-column navigation** — x-axis is a window of 5 cycles (2 before/after the active one), pooled from every project's shared team and centered on whichever cycle is active by default. Left/right arrows slide the window across cycle history.

**Collapsed view (default) — `ProjectSummaryBar`**  
Each cycle cell is highlighted if any milestone has an issue whose `cycle.id` matches — real membership, not date-range math (many milestones have no `targetDate`). Hovering shows which milestone(s) fall in that cycle.

**Expanded view — `MilestoneRow`**  
Per-milestone cycle cells, colored by actual completion + due date (not Linear's `status` field):

| Condition | Color |
|---|---|
| `progress >= 1` | Green |
| Open, past `targetDate` | Orange (overdue) |
| Open, not yet due | Blue/accent |
| No issue that cycle | Uncolored |

**Cycle drill-down panel** — clicking any cell opens a panel showing the *real, complete, team-wide* issue list for that cycle (`GET /roadmap?cycleId=`, optionally scoped by project/milestone), paginated, with client-side search + status/priority filters. Clicking an issue card opens `IssueDetailModal`; a pencil button opens `EditIssueModal` (saving invalidates the `roadmap` query).

### 7.4 Metrics Panel — `MetricsPanel`

**Data:** `GET /issueMetrics/?slug={slug}` → `{ issue_metrics[], cycle_metrics[] }`

**Filters:**
- Project selector (defaults to first project)
- Cycle selector (newest first; selecting a cycle auto-fills the date range)
- Date range (From / To) with a "Clear" link

**Cycle Scope vs Completed — `CycleBarChart`**  
Grouped bar chart: Scope vs Completed per cycle. Shows whether the team consistently completes what they plan.

**Issues by Status — `IssueMetricsView`**  
Stacked area chart driven by `cycle_metrics.issues_averages` — a day-by-day array of status-count snapshots accumulated across `issueMetrics` runs. Normally scoped to the selected cycle, but if the date range (not the cycle picker) was the last control the user directly edited, it instead merges every cycle's snapshots in that range into one series (heading switches to "— All cycles in range"). `Backlog` is excluded (this chart is always cycle-scoped, and Backlog issues never belong to a cycle). Mobile has a collapsible legend.

**Known gap:** a project with zero active cycles on a given day gets no `cycle_metrics` row at all that day (looks like the pipeline stopped, when it actually ran with nothing to report) — see `app/docs/TICKET_CYCLE_METRICS_PLACEHOLDER.md` for a drafted-but-reverted fix.

**Components available but not currently rendered:**  
`CycleHistoryChart`, `CycleTable`, `UncompletedIssuesList` — imported in `metrics-panel.tsx` but not rendered in the current UI.

Every panel on this page (Project Stats, DORA, Timeline, Metrics) has a `PinButton` in its corner — pins that panel onto the viewer's own dashboard (`portal.pinned_panels`, `hooks/use-pinned-panels.ts`). Cross-page feature (also on Build/Bugs), not fully written up here.

### 7.5 Data flow

```
User lands on /{slug}/monitor
  ├── GET /issues?slug → ProgressPieChart ("Project Stats")
  ├── GET /roadmap/?slug → projects+milestones flattened, cycles pooled → RoadmapTimeline
  ├── GET /get-dora-metrics?linear_name= → SoftwareKPIs (4 DORA tiles)
  ├── GET /issueMetrics/?slug → MetricsPanel (CycleBarChart + IssueMetricsView)
  └── (on cycle-cell click) GET /roadmap?cycleId= → drill-down panel
```

### 7.6 File Map

| File | Responsibility |
|---|---|
| `app/[slug]/(portal)/monitor/page.tsx` | Main page — fetches issues/roadmap data |
| `components/client/progress-pie-chart.tsx` | "Project Stats" donut, shared with Client Dashboard |
| `components/roadmap/software-kpis.tsx` | Software KPIs — fetches/renders the 4 DORA tiles |
| `components/roadmap/roadmap-timeline.tsx` | Timeline shell — cycle windowing, drill-down fetch/state |
| `components/roadmap/ProjectRow.tsx` | Collapsed/expanded project row, per-milestone cycle membership |
| `components/roadmap/ProjectSummaryBar.tsx` | Summary bar + `MilestoneRow` cycle cells |
| `components/roadmap/TimelineHeader.tsx` | Cycle-window prev/next + column labels |
| `components/dashboard/pin-button.tsx` / `hooks/use-pinned-panels.ts` | Per-panel pin/unpin (cross-page) |
| `components/metrics/metrics-panel.tsx` | Metrics filter bar + chart grid |
| `components/metrics/cycle-metrics.tsx` | CycleBarChart + unused chart components |
| `components/metrics/issues-metrics.tsx` | Issues by Status area chart |
| `components/build/edit-issue-modal.tsx` | Edit modal opened from the drill-down panel |
| `supabase/functions/roadmap/index.ts` | Backend: `?slug=` (projects/milestones/cycles) and `?cycleId=` (paginated team-wide cycle issues) |
| `supabase/functions/dora/` | Backend: computes DORA metrics from Git history, see [dora-flow.mmd](../supabase/functions/dora/diagrams/dora-flow.mmd) |
| `supabase/functions/get-dora-metrics/` | Read-only endpoint `SoftwareKPIs` calls |

---

---

## 8. Documents

> Customer/stakeholder (and admin previewing a customer): `app/[slug]/(portal)/documents/page.tsx`
> Developer's own page: `app/dev/documents/page.tsx` (no slug) — re-exports the same component

See `app/docs/DOCUMENTS_FLOWS.md` for the full write-up — this section is a summary.

### Who sees it

`customer`, `stakeholder`, `developer`, and `admin` (while previewing a customer). The page differs sharply by role now, not just per-document permissions (see 8.1).

### 8.1 Role-based panels

| Panel | Customer / Stakeholder | Developer / Admin |
|---|---|---|
| "Wiki — coming soon" banner + Request dialog | ✅ | — |
| Their own requests (read-only) | ✅ | — |
| Requests they can fulfill (`canManage`) | — | ✅ |
| Project Documents list | ✅ full width | ✅ 2/3 width |
| Upload Document panel | — | ✅ 1/3 width |

Customers/stakeholders no longer upload directly — they submit a **Document Request** and a developer/admin fulfills it (uploads + auto-shares in one step). See 8.2.

**Resolving scope:** `slug` (clientName-based) comes from the previewed customer → URL param → profile → assignment fallbacks. `projectSlug` (the actual Linear slug used to scope storage) is resolved separately — admins via a `customers` lookup (they're never in anyone's `assignment_id`), everyone else via `profile.assignment_id.find(clientName === slug)?.linear_slug` falling back to their own `profile.linear_slug`.

### 8.2 Document Requests

**Source:** `use-document-requests.ts`, `request-document-dialog.tsx`, `document-requests-list.tsx`, `developer-document-requests.tsx`, `fulfill-document-request-modal.tsx`. Backend: `supabase/functions/document-requests/*`, table `portal.document_requests`.

1. **Request** (customer/stakeholder): title, optional Linear project, optional link to a past request, optional details → `POST /document-requests`.
2. **View**: split into pending "Document Requests" and completed "Documents Received" panels, 3-at-a-time with Show More. Scoping differs by role — customer/stakeholder see their own customer's; admin sees whichever customer they're previewing; **developer sees every customer they're assigned to**, not just the one project the Documents list itself is scoped to.
3. **Claim** (developer/admin): `PATCH { action: "claim" }` — optimistic lock, `409` if already claimed by someone else (shows a "Claimed by" badge to everyone else).
4. **Fulfill**: one modal, one file, three calls — `POST /storage` (upload) → `POST /storage/share` (grants the requester `read` access) → `PATCH /document-requests` (mark done; blocked with `409` if claimed by someone else and the caller isn't `admin`).

### 8.3 Project Documents — `DocumentsList`

**Data:** `GET /storage?user_id={documentsOwnerId}&project_slug={projectSlug}` — `documentsOwnerId` (`usePinnedPanelsOwnerId()`) is the previewed customer's id when one is set, otherwise the caller's own — needed so an admin/developer previewing a customer sees *that customer's* documents, not their own.

| Field | Purpose |
|---|---|
| `id` | Unique identifier |
| `file_name` | Display name, used to derive file format icon |
| `category` | Reports / Technical / Design |
| `created_at` | Shown as formatted date |
| `size` | File size string |
| `permission` | `"owner"`, `"write"`, or `"read"` |
| `project_slug` | Groups document under a project folder |

**Search** — real-time text filter on file name (client-side).

**Category filter** — All / Reports / Technical / Design pills.

**Project grouping** — documents grouped by `project_slug`, header resolved to a human-readable name (from assignment/profile data, or the `customers` list for admins) rather than the raw slug. If 2+ projects, shows collapsible folder headers; if only one, folders hidden.

**Known gaps:** the Filter icon button next to Search has no `onClick` (decorative only); a `?id=` search param is included in the query cache key but doesn't actually filter results.

### 8.4 Document Row Actions

Actions appear on hover:

| Action | Who | What |
|---|---|---|
| **Open** | Everyone | `GET /storage/download?document_id=...&inline=true` → signed URL → new tab |
| **Download** | Everyone | `GET /storage/download?document_id=...` → signed download URL → new tab |
| **Share** | `write` or `owner` | Opens ShareDocumentModal |
| **Category** | `write` or `owner` | Popover with category options → `PUT /storage` |
| **Delete** | `owner` only | `DELETE /storage` → list refreshes |

### 8.5 Share Document Modal

Comma-separated email input → `POST /storage/share` with `{ document_id, emails[], user_id }`. On success the modal closes. Also how a fulfilled document request delivers its file (8.2 step 4).

### 8.6 Upload Document — `UploadDocument`

Only rendered for developer/admin (`canUpload`) — see 8.1.

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
| `project_slug` | The page-resolved `projectSlug` (8.1) — not the raw route slug |

### 8.7 Permission model

| Permission | Open | Download | Share | Change Category | Delete |
|---|---|---|---|---|---|
| `read` | ✅ | ✅ | ✗ | ✗ | ✗ |
| `write` | ✅ | ✅ | ✅ | ✅ | ✗ |
| `owner` | ✅ | ✅ | ✅ | ✅ | ✅ |

### 8.8 File Map

| File | Responsibility |
|---|---|
| `app/[slug]/(portal)/documents/page.tsx` | Page shell — slug/projectSlug resolution, role-based panel composition |
| `app/dev/documents/page.tsx` | Developer's own entry point — re-exports the same page |
| `components/documents/documents-list.tsx` | Document list with search, filter, grouping |
| `components/documents/document-list-panel.tsx` | Document rows with all actions |
| `components/documents/ShareDocumentModal.tsx` | Share modal |
| `components/documents/upload-document.tsx` | Upload panel (developer/admin only) |
| `components/documents/update-document-entry.ts` | `useUpdateDocument` + `useDeleteDocument` mutations |
| `components/documents/use-document-requests.ts` | Shared `useDocumentRequests` hook + type |
| `components/documents/request-document-dialog.tsx` | Customer/stakeholder request dialog |
| `components/documents/document-requests-list.tsx` | Pending/done panels, detail modal, claim button |
| `components/documents/developer-document-requests.tsx` | Role gate + scoping wrapper for developer/admin |
| `components/documents/fulfill-document-request-modal.tsx` | Upload-and-share-in-one-step fulfillment modal |
| `supabase/functions/document-requests/*` | Create / claim / mark-done endpoints |

---

---

## 9. Chat

> Customer/stakeholder page: `app/[slug]/(portal)/chat/page.tsx` → `CometChatPage`
> Developer's own page: `app/dev/chat/page.tsx` → `DevChatPage` (no slug)
> Admin's own page: `app/admin/chats/page.tsx` → `AdminChatPage` (no slug, unscoped inbox)

All three render the same `ChatLayout`. See `app/docs/CHAT_FLOWS.md` for the full write-up — this section is a summary.

### Who sees it

`customer`, `developer`, `stakeholder`, and `admin`. Admin and developer routes carry no customer slug (`/admin/chats`, `/dev/chat`), matching their slug-less dashboards (section 6, section 2's redirect table).

Two distinct chat surfaces exist:
- **The standalone page** — full chat with a sidebar and conversation view. The admin Dashboards preview (`panel-renderer.tsx`, `case "chat"`) renders the `/[slug]/(portal)/chat` version scoped to whichever customer is being previewed.
- **Issue Chat** (`IssueCometChat`) — the Chat tab inside the Issue Detail Modal, scoped to one issue (see Issue Flows section).

### 9.1 CometChat Initialization — `initCometChatUser`

Shared by both the standalone page's `useCometChat` and `IssueCometChat`:

1. `CometChat.init(APP_ID, settings)` — initialise SDK.
2. `supabase.auth.getUser()` — get the Supabase UID.
3. Login to CometChat using the Supabase UID:
   - Already logged in as same user → reuse session.
   - Logged in as different user → logout, then login.
   - UID not found in CometChat → auto-create user (name = email), then login.

### `useCometChat(customerId?)` — group fetching

Paginates `GroupsRequestBuilder` (50/page, up to 20 pages). Admins fetch every public group; everyone else, joined-only. An optional `customerId` filters the result to groups whose `customerId` metadata matches — used when scoped to one customer (see 9.2).

**Leaving a chat** (`leaveGroup`) calls `CometChat.leaveGroup` — a real membership removal, not just a local hide. Admins can't leave chats at all (`canLeaveChats` is false for that role) so they stay readable/auditable.

### 9.2 Page Layout — `ChatLayout`

Two-panel split: sidebar (left) + chat area (right).

**Mobile:** one panel at a time. Sidebar by default; selecting a chat hides it. A "Back to chats" button returns to the sidebar.

**Scoping to one customer:** `customerId` passed to `useCometChat` comes from `useCustomerSlug()` + `usePinnedPanelsOwnerId()` — empty on a plain `/chat`/`/dev/chat`/`/admin/chats` visit (unscoped inbox), resolved to the previewed customer's id inside the Dashboards preview. Separately, admins also get a manual dropdown filter (fetches all `role === "customer"` users) to narrow their own unscoped `/admin/chats` inbox to one customer at a time.

**Auto-open `CreateChatModal`** when `ready` fires **only** if the URL has `?newChat={title}` — there is no longer an auto-open for "customer with no chats".

### 9.3 Sidebar — `ChatSideBar`

**Group chats** — rows with avatar (initials) and group name. If groups span multiple `projectSlug` values (from group metadata), they are grouped into collapsible sections by project. When `canLeaveChats`, hovering a row shows ✕ to actually leave that chat (removes CometChat membership).

**Direct chats (AI Agent)** — the UI and `DirectChat.tsx` conversation view both still work, but nothing in the current app creates a new entry in this list — functionally dead, not removed.

**New Chat button** — always at the bottom of the sidebar; also in the header for customers only.

### 9.4 Creating a Group Chat — `CreateChatModal`

User types a title and clicks Create. `createSupportGroup(title, customerId?, projectSlug?)` assembles members automatically:

**If customer:** `GET /assignments?customer_id={profile.id}` → adds all assigned developers + stakeholders.

**If stakeholder:** `GET /assignments?developer={profile.id}` → finds the assigned customer, then `GET /assignments?customer_id={customerId}&onlyDev=true` → adds that customer's developers.

**If admin/developer creating on behalf of a previewed customer:** the customer's id is passed in directly (`customerId` arg) instead of derived from the creator.

For any UID not yet in CometChat → `CometChat.createUser()` is called first. Group GUID: `customer_{profile.id}_{timestamp}`, type `PUBLIC`. Metadata: `{ customerId, projectSlug }`. **Ownership is transferred** to a fixed staff account (`NEXT_PUBLIC_COMET_ADMIN_UID`) right after creation, so the creator can leave later without CometChat's `ERR_OWNER_EXIT_FORBIDDEN`.

### 9.5 Opening chat from an issue card

```
/acme/dashboard  →  /acme/chat?newChat=SPA-42%20Issue%20title
```

The `?newChat` param pre-fills the modal title and opens it automatically.

### 9.6 Issue Chat — lazy group creation

Unlike the standalone page, `IssueCometChat` never creates a group or adds members just for opening the tab — it only looks up the deterministic GUID `issue_{issueId}`. The group (and its members, resolved from whoever's role sends first — including a customer-lookup-by-slug path for a developer/admin sending first) is only created on the first message, with a "Creating chat and adding users…" loader and the same staff-ownership handoff as 9.4. See `app/docs/CHAT_FLOWS.md` for full detail.

### 9.7 Data flow

```
User lands on /{slug}/chat, /dev/chat, or /admin/chats
  ├── initCometChatUser() → init, resolve Supabase user, login/create-if-missing
  ├── customerId = customerSlug ? resolve-slug-to-id : undefined
  ├── fetchGroups(customerId) (paginated; joined-only unless admin; filtered if customerId set)
  ├── ready = true → UI renders
  ├── if ?newChat → CreateChatModal auto-opens
  └── User selects group → GroupChat renders with real-time listener
```

### 9.8 File Map

| File | Responsibility |
|---|---|
| `app/[slug]/(portal)/chat/page.tsx` | Customer/stakeholder entry (and admin previewing a customer) — reads `?newChat`, passes `fallbackProjectSlug` |
| `app/dev/chat/page.tsx` | Developer's own unscoped Chat page |
| `app/admin/chats/page.tsx` | Admin's own unscoped Chat page |
| `components/chat/CometChat/ChatLayout.tsx` | Two-panel layout, customer scoping/filter, selection state, auto-open logic |
| `components/chat/CometChat/ChatSideBar.tsx` | Sidebar — groups, direct chats (unreachable), projectSlug grouping, admin customer filter |
| `components/chat/CometChat/useCometChat.ts` | Group fetch/pagination, group creation, `leaveGroup` |
| `components/chat/CometChat/initCometChatUser.ts` | Shared SDK init + login/create-user logic |
| `components/chat/CometChat/CreateChatModal.tsx` | New chat modal |
| `components/chat/CometChat/GroupChat.tsx` | Standalone-page group conversation view |
| `components/chat/CometChat/DirectChat.tsx` | AI agent direct conversation — currently unreachable |
| `components/chat/CometChat/IssueCometChat.tsx` / `getOrCreateIssueGroup.ts` / `IssueGroupChat.tsx` | Embedded issue chat — lazy group creation on first message |
| `components/chat/CometChat/constants.ts` | APP_ID, REGION, AUTH_KEY |

---

---

## 10. Settings

> Main page: `app/[slug]/(portal)/settings/page.tsx`

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

**Data:** `GET /assignments?customer_id={userId}` → all assigned developers and stakeholders. The edge function also looks up each `user_id` in `portal.developers` and attaches `bio`/`tech_stack`/`developer_type` to the row, plus the assignment's own `id` (as `assignment_id`).

Each team member card shows: avatar (initials), name, email, role badge (always "active"), join date, weekly hours (`allocation`).

**Developer Details popup — `DeveloperDetailsModal`** — clicking a team member card opens a dialog with name, email, role/position, date added, bio (falls back to "No bio provided yet."), and tech stack as badges (falls back to "No tech stack listed yet."). Purely presentational — it just renders the `bio`/`tech_stack` already on the assignment row. Admins edit these values from the Admin Panel (§3.8 Edit Developer Profile).

An **Edit** button appears in the popup header only when `profile.role === "customer"` **and** the developer's `developer_type` is `"internal"` — i.e. one the customer added themselves (see Add Developer below). Not shown for `spark_fde` developers or to admins. Clicking it opens `EditInternalDeveloperModal`.

**Add Developer button — `AddDeveloperModal`** (customer-facing, `components/settings/add-developer-modal.tsx`) — shown only when `profile.role === "customer"`. A toggle lets the customer either:
- **Internal** — fill in email (required), name, phone, weekly hours (required), and optional bio/tech stack (shared `TechStackPicker`), then immediately create the developer (`POST /users?type=developer` with `developerType: "internal"`, optionally `PATCH /users?type=developer-profile` for bio/tech stack) and assign them (`POST /assignments`). The Staffing list refreshes right away.
- **Spark & Co FDE** — fill in role needed (required), optional weekly hours, optional notes, then `POST /developer-requests`, which emails every `admin` user the request. No account/assignment is created — an admin assigns an actual developer manually afterward.

Internal developers created this way are indistinguishable from admin-created ones in the Admin Panel — same `users` row, same `role: "developer"` — so admins can View/Edit Profile and re-assign them normally (§3.1).

**Editing an Internal developer — `EditInternalDeveloperModal`** (`components/settings/edit-internal-developer-modal.tsx`) — pre-fills from the team member row already in memory (no extra fetch). Editable: first/last name, phone, weekly hours (required), bio, tech stack. On save: `PATCH /users` (name/phone) → `PATCH /users?type=developer-profile` (bio/tech stack) → `PATCH /assignments` (weekly hours, via the new `updateAssignment.ts` handler — `POST /assignments` only creates/no-ops on an existing pair, it never updates `allocation`). Invalidates `["assignments", customerId]` on success.

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
User lands on /{slug}/settings
  ├── if admin viewing customer:
  │     GET /users?type=customers → resolve effectiveUserId + effectiveCustomerId
  ├── GET /stripe/client?customer_id → billing data
  ├── Staffing tab (default):
  │     GET /assignments?customer_id → team members
  └── Billing tab:
        PendingBalance + NextPayment + Invoices + PaymentMethod
```

### 10.5 API Endpoints

| Action | Method | Endpoint |
|---|---|---|
| List team members for a customer (includes `bio`/`tech_stack`/`developer_type`) | GET | `/assignments?customer_id={userId}` |
| Create a developer (used for customer-added Internal developers) | POST | `/users?type=developer` |
| Update a user's name/phone (used to edit an Internal developer) | PATCH | `/users` |
| Get/update a developer's bio + tech stack | GET / PATCH | `/users?type=developer-profile` |
| Assign a developer to a customer | POST | `/assignments` |
| Update an assignment's weekly hours | PATCH | `/assignments` |
| Request a Spark & Co FDE developer (emails all admins, no record created) | POST | `/developer-requests` |
| Get Stripe billing snapshot | GET | `/stripe/client?customer_id={stripeCustomerId}` |
| Open Stripe Customer Portal (add/update card, renew) | POST | `/stripe/create-customer-portal` |

### 10.6 File Map

| File | Responsibility |
|---|---|
| `app/[slug]/(portal)/settings/page.tsx` | Page shell |
| `components/settings/settings-tabs.tsx` | Tab switcher, ID resolution for admin |
| `components/settings/staffing-section.tsx` | Team list + Cal.com button |
| `components/settings/developer-details-modal.tsx` | Popup shown when a team member card is clicked |
| `components/settings/add-developer-modal.tsx` | Customer-facing Add Developer modal (Internal creation + Spark & Co FDE request) |
| `components/settings/edit-internal-developer-modal.tsx` | Customer-facing edit modal for their own Internal developers |
| `components/shared/tech-stack-picker.tsx` | Shared drag-to-reorder tech stack chip editor |
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
