# Admin Panel — Flows & How It Works

> Reference file for the portal's administration panel.  
> Main page: `app/admin/users/page.tsx` → `AdminUsersPage`

---

## Access & Security

The admin panel is only accessible to users with `role === "admin"`.  
If anyone tries to open it with a different role, the component renders a "Not authorized" message and stops there.  
The role comes from the global `UserContext`, which loads the user profile from Supabase on login.

> Admin accounts are created directly in the **Supabase Authentication UI** — not through the portal itself.

---

## Page Structure

The page has **two views** toggled from a switcher at the top:

| View | Description |
|---|---|
| **Users** | Lists every user in the system with their roles and lets you manage them |
| **Projects** | Shows each customer and which developers / stakeholders are assigned to them |

Three action buttons sit in the top-right corner:

- `Add Developer`
- `Add Customer`
- `Add Stakeholder`

---

## Users View

### What it loads

When the **Users** view mounts, it calls `GET /users` to fetch every registered user. Each row shows:

- Initials avatar (generated from the email)
- Email
- Colored role badge (admin, developer, customer, stakeholder)
- Expand arrow button
- **View Profile** button (visible on hover, developers only) — opens `ViewDeveloperProfileModal`, sits to the left of Edit Profile
- **Edit Profile** button (visible on hover, developers only) — opens `EditDeveloperProfileModal`
- **Assign** button (visible on hover, only for developers and stakeholders)

### Search & filters

Two ways to narrow the list down:

1. **Text search** — filters by email or username in real time, no extra API calls.
2. **Role filter** — pill buttons for admin / developer / customer / stakeholder. Can be combined with the text search.

If nothing matches, an empty state with an icon is shown.

### Expanding a user

Clicking the arrow on any user opens a panel showing their **current assignments**:

- **Customer** → shows the developers and stakeholders assigned to them, with role, join date, and weekly hours.
- **Developer / Stakeholder** → shows the customers they are assigned to, with join date and weekly hours.

Data loads on demand when the row expands — it is not prefetched. The query is `GET /assignments?developer={id}` or `GET /assignments?customer_id={id}` depending on the role.

---

## Projects View

This view presents the same assignment data but organized **from the customer's perspective**.

Each block represents a **customer** and lists all developers and stakeholders assigned to them — email, role, join date, and weekly hours.

If a customer has no one assigned, the block shows "No developers assigned yet."

Data loads in batch when the view mounts: all customer IDs are collected first, then a single request `GET /assignments?customer_id=id1,id2,...` is made for all of them at once.

---

## Add Developer — `AddDeveloperModal`

**Opened by:** `Add Developer` button in the page header.

The admin fills in:

| Field | Required | Notes |
|---|---|---|
| Email | ✅ Yes | Used as the login identifier |
| First name | No | |
| Last name | No | |
| Username | No | Sent as `clientName` |
| Phone number | No | |
| Developer Type | ✅ Yes (defaults to Spark & Co FDE) | Toggle: **Spark & Co FDE** or **Internal** |
| Rate amount + Rate type | Only shown/required when **Internal** | Rate type is Hourly, Monthly, or Annual |

**Developer Type** determines billing treatment: **Spark & Co FDE** developers are billed to customers through their Stripe subscription (unchanged, still fully manual). **Internal** developers are not customer-billed — instead the admin sets an internal `rate_amount`/`rate_type`, stored for record-keeping only. This is purely a categorization + data field right now; no billing/invoice computation reads it yet.

On confirm, calls `POST /users?type=developer` with `{ email, role: "developer", origin, developerType, ...(internal && { rateAmount, rateType }), ...optionalFields }`.  
The `origin` field is the portal's URL (e.g. `https://app.sparkco.io`), which the backend uses to build the invitation link in the welcome email.

**Backend side-effect:** `createUser.ts` upserts a `portal.developers` row (`user_id`, `developer_type`, `rate_amount`, `rate_type`) right after the `users` row is created — `rate_amount`/`rate_type` are only persisted when `developer_type = "internal"`. This is the same table `bio`/`tech_stack` live on (see Edit Developer Profile below), but Developer Type/Rate are only set at creation time — not currently editable from `EditDeveloperProfileModal`.

The new user receives an **invitation email** with a link to set their password and access the portal.  
On success, the user list refreshes automatically.

---

## Add Customer — `AddClientModal`

**Opened by:** `Add Customer` button in the page header.

This is the most complete flow because a customer requires two external integrations:

| Field | Required | Notes |
|---|---|---|
| Email | ✅ Yes | |
| Client name | No | Display name seen by developers |
| First name | No | |
| Last name | No | |
| Phone number | No | |
| Stripe Customer ID | ✅ Yes | Used for billing and payments |
| Linear Slug | ✅ Yes | Identifies the customer's Linear workspace — needed to create and list issues |

> **Important:** The "Create" button stays disabled until all three required fields (email, Stripe ID, and Linear slug) are filled in.

On confirm, calls `POST /users?type=customer` with all fields.  
The customer receives an invitation email, just like developers.

The `linear_slug` is critical: without it the customer won't see their issues in the portal, and the team won't be able to create requests under their workspace.

**Backend side-effects (`createCustomerFlow`, `supabase/functions/users/createCustomerFlow.ts`):**

1. Creates the `customers` row with `linear_slug`, `clientName`, and the Stripe ID.
2. Looks up the Linear initiative identified by `linear_slug`, collects its projects (`linear_projects`), and for each project scans its issues' attachments for a linked GitHub issue/PR to derive the repo's GitHub URL (`project_url`). Both are saved back onto the `customers` row. This step is best-effort — if Linear lookups fail or return nothing, customer creation still succeeds.
3. Upserts the `users` row for the customer and sends the invite email.
4. If `linear_projects`/`project_url` were successfully populated, fires `POST /functions/v1/issueMetrics` (no body) to immediately compute metrics for the new customer. That call's final step also runs `triggerDoraForAllCustomers()`, so `/dora` runs for this (and every other eligible) customer right away — no need to wait for the next cron run.

---

## Add Stakeholder — `AddStakeholderModal`

**Opened by:** `Add Stakeholder` button in the page header.

A stakeholder is someone on the client side who can view the portal and approve things, but is not the primary contact. The flow is identical to adding a developer:

| Field | Required | Notes |
|---|---|---|
| Email | ✅ Yes | |
| First name | No | |
| Last name | No | |
| Username | No | Sent as `userName` |
| Phone number | No | |

On confirm, calls `POST /users?type=stakeholder` with `{ email, role: "stakeholder", origin, ...optionalFields }`.

---

## Assign a Developer or Stakeholder to a Customer — `AssignCustomerModal`

**Opened by:** The **Assign** button that appears on hover over any `developer` or `stakeholder` row in the user list.

This is the step that **connects** a team member to a customer. Without this assignment, the developer won't see the customer's issues and won't appear in their portal.

### What the modal shows

First it loads and displays the user's **current assignments** — the customers they're already linked to, with weekly hours. Already-assigned customers appear disabled in the dropdown to prevent duplicates.

### Creating a new assignment

1. Select the customer from the dropdown.
2. If assigning a **developer**, enter the weekly hour commitment (`allocation`). This field does not appear for stakeholders.
3. Click **Assign**.

Calls `POST /assignments` with `{ user_id, customer_id, role, allocation }`.

On success:
- The user list refreshes
- The expanded assignment panel for that user also updates
- The modal closes

---

## View Developer Profile — `ViewDeveloperProfileModal`

**Opened by:** The **View Profile** button that appears on hover over any `developer` row, immediately to the left of **Edit Profile**.

Renders the exact same popup customers see on the Staffing tab — `DeveloperDetailsModal` (`components/settings/developer-details-modal.tsx`) — so admins can preview what a developer's card looks like without leaving the Users list.

On open, calls `GET /users?type=developer-profile&userId={id}` to load `bio`/`tech_stack` and feeds them into `DeveloperDetailsModal` along with the row's name/email/role already in memory (no `joined` date, since this view isn't scoped to a specific customer assignment). The dialog opens immediately and fills in bio/tech stack once the fetch resolves.

---

## Edit Developer Profile — `EditDeveloperProfileModal`

**Opened by:** The **Edit Profile** button that appears on hover over any `developer` row in the user list (not shown for other roles).

Lets an admin set the **bio** and **tech stack** shown to customers on the developer's Staffing card popup (see `SETTINGS_FLOWS.md` → Developer Details popup). These fields live on `portal.developers`, not `portal.users`, and are **not** part of the Add Developer flow — a developer's `portal.developers` row may not exist yet, so the save upserts it.

### What the modal shows

On open, calls `GET /users?type=developer-profile&userId={id}` to load the developer's current `bio` and `tech_stack`. While loading, the form shows a loading state.

### Editing

- **Bio** — free-text textarea.
- **Tech Stack** — type a technology and press Enter (or `,`) to add it as a plate/chip; click the `×` on a chip to remove it; **drag a chip by its grip handle to reorder** the stack. Rendered by the shared `TechStackPicker` (`components/shared/tech-stack-picker.tsx`, same `@dnd-kit` sortable-list mechanism as the Steps editor in the issue detail modal's Tests tab, laid out as a wrapping row of pills instead of a stacked list). This same picker is also used by the customer-facing Add Developer modal (`SETTINGS_FLOWS.md` → Add Developer button). The saved order is what's shown on the Staffing card popup.

### Saving

Click **Save Changes** → `PATCH /users?type=developer-profile` with `{ userId, bio, tech_stack }`. The backend upserts onto `portal.developers` keyed by `user_id` (`onConflict: "user_id"`), so it works whether or not a row already exists for that developer.

On success, the `developer-profile` and `assignments` queries are invalidated so any open Staffing views pick up the change, and the modal closes.

---

## Receiving a Spark & Co FDE Developer Request

Customers can request a Spark & Co FDE developer for their own initiative from the Staffing tab of their Settings page (see `SETTINGS_FLOWS.md` → Add Developer button → Spark & Co FDE). That flow does **not** create a user or assignment — it's a notification only.

When a customer submits the request, `POST /developer-requests` looks up every `role: "admin"` user in `portal.users` and emails each one (role needed, weekly hours if given, notes, and which customer requested it).

**To fulfill a request:** go to the Admin Panel → `Add Developer` (creating a `spark_fde`-type developer, the default) → then hover their row → `Assign` → select the requesting customer and set the weekly hours.

---

## Full Flow: Onboarding a New Client

Recommended order when bringing a new customer into the system:

```
1. Create the Customer
   → Requires email + Stripe ID + Linear slug
   → Customer receives an invitation email

2. Create the Developers who will work on the project
   → Only requires email
   → Each developer receives an invitation email

3. (Optional) Create additional Stakeholders on the client side
   → People who approve things but are not the main contact

4. Assign each Developer to the Customer
   → From the Users list, hover → Assign
   → Select the customer and set the weekly hours (h/week)

5. (Optional) Assign Stakeholders to the same Customer
   → Same flow, no allocation field

6. Verify in the Projects view
   → The customer's block should show all assignees correctly
```

---

## API Endpoints

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
| Request a Spark & Co FDE developer (customer-only, emails all admins) | POST | `/developer-requests` |

---

## File Map

| File | Responsibility |
|---|---|
| `app/admin/users/page.tsx` | Main page — Users and Projects views |
| `app/admin/users/AddDeveloperModal.tsx` | Modal to create a developer |
| `app/admin/users/AddClientModal.tsx` | Modal to create a customer |
| `app/admin/users/AddStakeholderModal.tsx` | Modal to create a stakeholder |
| `app/admin/users/AssignCustomerModal.tsx` | Modal to assign a developer/stakeholder to a customer |
| `app/admin/users/EditDeveloperProfileModal.tsx` | Modal to edit a developer's bio and tech stack |
| `app/admin/users/ViewDeveloperProfileModal.tsx` | Fetches a developer's bio/tech stack and renders the same popup shown on the Staffing tab |
| `components/settings/developer-details-modal.tsx` | Shared popup component — used from both Staffing (customer view) and here (admin preview) |
| `components/shared/tech-stack-picker.tsx` | Shared drag-to-reorder tech stack chip editor — used by Edit Developer Profile and the customer-facing Add Developer modal |
| `supabase/functions/developer-requests/` | Edge function — emails all admins when a customer requests a Spark & Co FDE developer |
| `context/UserContext.tsx` | Provides `profile.role` for access control |
