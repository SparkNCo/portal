# Settings — Flows & How It Works

> Reference for the Settings page and its tabs.  
> Main page: `app/[slug]/dashboard/(portal)/settings/page.tsx` → `SettingsPage`

---

## Who sees this page

Settings is accessible to `customer` users via their sidebar. Admins also see it when viewing a specific customer's panel through the Dashboards view.

Developers and stakeholders do **not** have Settings in their sidebar nav.

---

## Admin viewing a customer's settings

When an admin navigates to a customer's settings (via Dashboards → select customer → Settings), `CustomerSlugContext` provides the customer's slug. The `SettingsTabs` component detects this (`isAdminViewingCustomer = profile.role === "admin" && !!customerSlug`) and fetches the customer list to resolve the correct `userId` and `customer_id` (Stripe ID) for that customer.

This means the admin sees the same billing and staffing data the customer would see — useful for support and account management.

---

## Tab structure

The settings page has two tabs:

| Tab | Content |
|---|---|
| **Staffing** *(default)* | The team assigned to this customer |
| **Billing** | Stripe subscription, invoices, and payment method |

> Note: the code contains a hidden `"documents"` tab case (`activeTab === "documents"`) but there is no tab button for it, making it unreachable in the current UI.

---

## Tab 1 — Staffing

**Source:** `components/settings/staffing-section.tsx`

### Data loading

Calls `GET /assignments?customer_id={userId}` to fetch all developers and stakeholders assigned to the customer. The edge function (`getAssignmentsByCustomer.ts`) joins the `assignments` and `users` tables, then does a second lookup against `portal.developers` (keyed by `user_id`) to attach each row's `bio` and `tech_stack`. Each result row is mapped to a team member with: name, email, role, weekly hours (`allocation`), join date, bio, and tech stack.

### What it shows

Each team member appears as a **clickable card** with:
- Avatar (initials)
- Name and email
- Role badge (always shown as `active`)
- Join date
- Weekly hour commitment (e.g. `20h/week`)

Clicking anywhere on the card opens the **Developer Details popup**.

### Developer Details popup — `DeveloperDetailsModal`

**Source:** `components/settings/developer-details-modal.tsx`

Clicking a team member card opens a dialog showing:
- Name and email
- Role/position
- Date added (`joined`)
- Bio — falls back to "No bio provided yet." if empty
- Tech stack — rendered as badges, falls back to "No tech stack listed yet." if empty

The popup is purely presentational — it renders whatever `bio`/`tech_stack` came back on the assignment row and does not fetch anything itself. Bio and tech stack are edited by admins from the Admin Panel (see `ADMIN_FLOWS.md` → Edit Developer Profile), or by customers themselves for their own **Internal** developers (see Edit button below).

**Edit button:** shown in the popup header only when `profile.role === "customer"` **and** the developer's `developer_type` is `"internal"` (i.e. one the customer added themselves — see Add Developer below). Not shown for `spark_fde` developers or to admins previewing the tab. Clicking it closes this popup and opens `EditInternalDeveloperModal`.

### Add Developer button — `AddDeveloperModal` (customer-facing)

**Source:** `components/settings/add-developer-modal.tsx`

Shown only when `profile.role === "customer"` (not shown to admins previewing a customer's Staffing tab — admins use the Admin Panel's own Add Developer / Assign flows instead). Lets a customer add a developer to their own initiative without going through an admin, via a toggle:

**Internal** — the customer's own engineer, added directly:
1. Customer fills in email (required), first/last name, phone, weekly hours (required), and optionally bio + tech stack (same drag-and-drop `TechStackPicker` used elsewhere — see below).
2. `POST /users?type=developer` with `developerType: "internal"` creates the auth user, the `users` row, and upserts a `portal.developers` row (no rate — that's admin-only). The new developer gets the standard invite email.
3. If bio/tech stack were filled in, `PATCH /users?type=developer-profile` sets them (the create endpoint doesn't accept these fields, so it's a follow-up call to the same endpoint `EditDeveloperProfileModal` uses).
4. `POST /assignments` with `{ user_id, customer_id, role: "developer", allocation }` attaches them to the customer's initiative immediately.
5. On success, the `["assignments", customerId]` query is invalidated so the new developer shows up in the Staffing list right away.

**Spark & Co FDE** — a request, not a direct creation:
1. Customer fills in the role needed (required), optional weekly hours, and optional notes.
2. `POST /developer-requests` looks up every `admin` user and emails each one the request details (role, hours, notes, requesting customer). No user or assignment is created — an admin assigns an actual Spark & Co developer manually from the Admin Panel afterward.

Internal developers created here are the same `users` rows an admin sees in the Admin Panel's Users list — nothing about how they were created is hidden or filtered there; admins can View/Edit Profile and re-assign them exactly like any other developer.

### Editing an Internal developer — `EditInternalDeveloperModal`

**Source:** `components/settings/edit-internal-developer-modal.tsx`

Opened from the Edit button on the Developer Details popup (only available to the customer, only for their own `internal`-type developers). Pre-fills from the team member row already in memory (first/last name, phone, bio, tech stack, weekly hours) — no extra fetch on open.

Editable: first/last name, phone number, weekly hours (required), bio, and tech stack (shared `TechStackPicker`).

On save, three calls run in sequence:
1. `PATCH /users` with `{ id: userId, firstName, lastName, phoneNumber }` — the same generic user-update endpoint (`updateUser.ts`) used elsewhere.
2. `PATCH /users?type=developer-profile` with `{ userId, bio, tech_stack }`.
3. `PATCH /assignments` with `{ id: assignmentId, allocation }` — a new handler (`updateAssignment.ts`) added specifically for this, since the existing `POST /assignments` only creates or no-ops on an existing pair, it never updates `allocation`.

On success, the `["assignments", customerId]` query is invalidated so the Staffing list reflects the changes immediately.

### Shared: `TechStackPicker`

**Source:** `components/shared/tech-stack-picker.tsx`

Type-to-add + drag-to-reorder "plate" chip editor (same `@dnd-kit` sortable mechanism as the Steps editor in the issue detail modal's Tests tab). Extracted out of `EditDeveloperProfileModal` once this Add Developer modal became a second consumer — both now share the same component.

### Request Change button

A **"Request Change"** button opens a **Cal.com booking link** in a new tab. It pre-fills the attendee email with the first assigned developer's email (falling back to the current user's email). This lets the customer book a call to request staffing adjustments.

> The Cal.com link is currently hardcoded to a specific calendar URL in the component.

---

## Tab 2 — Billing

**Source:** `components/settings/billing-section.tsx`

### Data loading

Calls `GET /stripe/client?customer_id={stripeCustomerId}` to fetch the full Stripe billing snapshot. The response contains:

| Field | Content |
|---|---|
| `subscription` | Stripe subscription object including `status` |
| `upcomingInvoice` | Next scheduled invoice — date and amount |
| `invoices[]` | Historical invoice list |
| `paymentMethod` | Card brand, last 4 digits, expiry |

If the subscription doesn't have an `id` yet (still loading or not set up), a loading panel is shown instead of the billing UI.

### Billing sub-panels

#### Outstanding Balance — `PendingBalancePanel`

Calculates the total unpaid amount across all invoices (`amountDue - amountPaid` summed). Displays in large bold text:
- **Green** if balance is zero ("No outstanding balance")
- **Warning yellow** if balance is positive ("Payment required to avoid service interruption")

#### Next Invoice — `NextPaymentPanel`

Shows the next invoice date and estimated amount from `upcomingInvoice`.

**If the subscription is canceled:** Shows a "Your subscription is currently canceled" message and a **Renew Subscription** button, which opens the Stripe Customer Portal.

**If no upcoming invoice is scheduled** (active subscription but nothing due yet): Shows "No upcoming invoice scheduled."

#### Invoice History — `InvoicesPanel`

Lists all historical invoices, showing date, amount, and a colored status badge:

| Status | Color |
|---|---|
| `paid` | Green |
| `open` | Yellow |
| `void` | Grey |
| `uncollectible` / `failed` | Red |

The list shows the 5 most recent invoices by default. A **"Show all N invoices"** toggle expands the full history. Each invoice with a PDF has a download button that opens the Stripe-hosted PDF in a new tab.

#### Payment Method — `PaymentMethodPanel`

Shows the card on file: brand (e.g. VISA), last 4 digits, and expiry date.

- If no card is on file: shows "No payment method added" with an **Add Card** button.
- If a card exists: shows the card details with an **Update Card** button.

Both the Add and Update buttons call `POST /stripe/create-customer-portal` with the user's email. On success, the response contains a Stripe-generated portal URL which is opened in a new tab. The Stripe Customer Portal handles all card management securely without the portal handling raw card data.

---

## Full data flow on page load

```
User lands on /{slug}/dashboard/settings
          │
          ├── if admin viewing customer
          │     → GET /users?type=customers
          │     → find customer matching customerSlug
          │     → resolve effectiveUserId + effectiveCustomerId
          │
          ├── GET /stripe/client?customer_id={effectiveCustomerId}
          │     → subscription, upcomingInvoice, invoices, paymentMethod loaded
          │
          ├── Tab: Staffing (default)
          │     → GET /assignments?customer_id={effectiveUserId}
          │     → team members rendered
          │
          └── Tab: Billing
                → BillingSection renders sub-panels from billing data
                → PendingBalance + NextPayment + Invoices + PaymentMethod
```

---

## API Endpoints

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

---

## File Map

| File | Responsibility |
|---|---|
| `app/[slug]/dashboard/(portal)/settings/page.tsx` | Page shell |
| `components/settings/settings-tabs.tsx` | Tab switcher — resolves effective IDs for admin, fetches billing data |
| `components/settings/staffing-section.tsx` | Team members list + Request Change (Cal.com) button |
| `components/settings/developer-details-modal.tsx` | Popup shown when a team member card is clicked (name, role, date added, bio, tech stack) |
| `components/settings/add-developer-modal.tsx` | Customer-facing Add Developer modal (Internal creation + Spark & Co FDE request) |
| `components/settings/edit-internal-developer-modal.tsx` | Customer-facing edit modal for their own Internal developers (name, phone, bio, tech stack, weekly hours) |
| `components/shared/tech-stack-picker.tsx` | Shared drag-to-reorder tech stack chip editor (used here and by the admin Edit Developer Profile modal) |
| `components/settings/billing-section.tsx` | Billing layout — assembles all four billing panels |
| `components/settings/billing-panels/pending-balance.tsx` | Outstanding balance panel |
| `components/settings/billing-panels/next-payment-panel.tsx` | Next invoice date + canceled subscription state |
| `components/settings/billing-panels/invoices-panel.tsx` | Invoice history list with PDF download |
| `components/settings/billing-panels/payment-method-expand.tsx` | Payment card display + Stripe portal redirect |
| `context/CustomerSlugContext.tsx` | Provides the customer slug when admin is previewing |
