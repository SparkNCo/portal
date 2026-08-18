# Settings — Flows & How It Works

> Reference for the Settings page and its tabs.  
> Main page: `app/[slug]/(portal)/settings/page.tsx` → `SettingsPage`

---

## Who sees this page

Settings is accessible to `customer` users via their sidebar. Admins also see it when viewing a specific customer's panel through the Dashboards view.

Developers and stakeholders do **not** have Settings in their sidebar nav.

---

## Admin viewing a customer's settings

When an admin navigates to a customer's settings (via Dashboards → select customer → Settings), `CustomerSlugContext` provides the customer's slug. The `SettingsTabs` component detects this (`isAdminViewingCustomer = profile.role === "admin" && !!customerSlug`) and fetches the customer list to resolve three separate IDs for that customer, falling back to the admin's own profile when not viewing one:

- `effectiveUserId` — used for Staffing (`assignments.customer_id`)
- `effectiveStripeId` — the Stripe customer id, used for `/stripe/client`
- `effectiveCustomerId` — the internal `portal.customers` primary key, used for `/stripe-edit` and the Stripe Customer ID panel

`customer_id` and the Stripe customer id are **not** the same value — `effectiveCustomerId` identifies the row in the `customers` table, while `effectiveStripeId` is that row's `stripe_customer_id` column (which can be empty — see Stripe Customer ID panel below).

This means the admin sees the same billing and staffing data the customer would see — useful for support and account management. Admins additionally get billing-management controls (Stripe Customer ID, invoicing mode, invoice amount/frequency) that customers never see — see below.

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

**Source:** `components/settings/billing-section.tsx` (layout + `StripeIdPanel`, `BillingModeToggle`, `InvoiceSettingsPanel`, all defined inline in this file), `components/settings/settings-tabs.tsx` (data loading/ID resolution)

> As of the `SPA-384/make-auto-billing-optional` work, a customer's Stripe Customer ID is optional and billing can be switched between automatic (live Stripe subscription) and manual (invoiced outside the portal). The four original sub-panels only render once a Stripe Customer ID is on file **and** billing is in automatic mode.

### Data loading

`SettingsTabs` runs two independent queries once `effectiveCustomerId`/`effectiveStripeId` are resolved (see "Admin viewing a customer's settings" above):

1. `GET /stripe-edit?customer_id={effectiveCustomerId}` — the customer's `billing_mode`, `invoice_amount`, `invoice_interval`, `invoice_interval_count`. Enabled whenever `effectiveCustomerId` exists, regardless of billing mode.
2. `GET /stripe/client?customer_id={effectiveStripeId}` — the Stripe billing snapshot. Only enabled when `effectiveStripeId` exists **and** the billing mode from query 1 is `"automatic"` (`enabled: !!effectiveStripeId && effectiveBillingMode === "automatic"`). In manual mode, or with no Stripe Customer ID, this call never fires.

The snapshot response contains:

| Field | Content |
|---|---|
| `subscription` | Stripe subscription object including `status` |
| `upcomingInvoice` | Next scheduled invoice — date and amount |
| `invoices[]` | Historical invoice list |
| `paymentMethod` | Card brand, last 4 digits, expiry |

### Billing sub-panels

`BillingSection` renders panels top to bottom based on `stripeCustomerId`, `isAdmin`, and `billingMode`:

#### Stripe Customer ID — `StripeIdPanel`

Always rendered first, for every role.

- **No Stripe Customer ID on file:** shows a "No Stripe Customer ID on file" card. Admins see an **Add Stripe ID** button; customers see "Contact your administrator to set up billing information." with no button. None of the other billing panels render at all in this state.
- **ID on file, viewer is admin:** shows an **"Edit Stripe Customer ID (only admins)"** button.
- **ID on file, viewer is a customer:** nothing rendered here (customers can't see or edit the raw ID).

Saving (add or edit) calls `PATCH /users?type=customer` with `{ customer_id, stripe_customer_id }`, then invalidates the `["customers"]` and `["billing"]` queries.

#### Invoicing mode — `BillingModeToggle`

Admin-only, shown once a Stripe Customer ID exists. Displays the current mode (`Automatic`/`Manual`) and a button to flip it, calling `PATCH /stripe-edit` with `{ customer_id, billing_mode }`.

- **Automatic → Manual:** pauses collection (`pause_collection: { behavior: "void" }`) on every active/trialing/past_due Stripe subscription for that customer. Nothing is written off — Stripe just stops attempting to charge it.
- **Manual → Automatic:** resumes collection on any subscription that was paused.

While in manual mode, the four original panels are replaced by a single static card: **"This client is invoiced manually — billing details, invoices, and payment methods are handled outside the portal."**

#### Invoice amount & frequency — `InvoiceSettingsPanel`

Admin-only, shown once a Stripe Customer ID exists **and** billing mode is automatic. Shows the current schedule (e.g. "$500.00 every month") or "Not set yet", with an **Edit** button that opens an amount + interval-count + interval-unit (day/week/month/year) form.

Saving calls `PATCH /stripe-edit` with `{ customer_id, invoice_amount, invoice_interval, invoice_interval_count }`. Server-side, this creates a brand-new Stripe `Price` (prices are immutable — "editing" always means creating a new one) and re-points the customer's active subscription item at it with `proration_behavior: "none"`, so nothing is charged early for the switch itself. If the customer has no active subscription yet, the values are still saved to the `customers` row and simply have no subscription to apply to yet — the UI shows a notice: *"Saved, but this client has no active Stripe subscription yet — nothing is being charged until one exists."*

#### Outstanding Balance — `PendingBalancePanel`

Calculates the total unpaid amount across all invoices (`amountDue - amountPaid` summed). Displays in large bold text:
- **Green** if balance is zero ("No outstanding balance")
- **Warning yellow** if balance is positive ("Payment required to avoid service interruption")

#### Next Invoice / Subscription status — `NextPaymentPanel`

Shows a subscription-status badge (active, trialing, past_due, incomplete, paused, canceled, unpaid, incomplete_expired — each with its own color) whenever a subscription exists.

**Needs renewal** — no subscription at all, or status is `canceled`, `unpaid`, or `incomplete_expired` (a subscription killed by repeated failed payments lands on `unpaid`/`incomplete_expired`, not just `canceled`, so both get the same treatment): shows "Your subscription is currently {status}." (or "You don't have an active subscription.") and a **Renew Subscription** button. This calls `POST /stripe/renew-subscription` with `{ customer_id }` directly — it no longer opens the Stripe Customer Portal.

**Otherwise (subscription active-ish):** shows a **Cancel Subscription** button, which opens a confirmation dialog warning that cancellation is immediate (not at period end) and can't be undone from here. Confirming calls `POST /stripe/cancel-subscription` with `{ subscription_id }`, which cancels the Stripe subscription right away.

Below that, either the next invoice date/estimated amount from `upcomingInvoice`, or "No upcoming invoice scheduled." if the subscription is active but nothing is due yet.

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
User lands on /{slug}/settings
          │
          ├── if admin viewing customer
          │     → GET /users?type=customers
          │     → find customer matching customerSlug
          │     → resolve effectiveUserId + effectiveStripeId + effectiveCustomerId
          │
          ├── GET /stripe-edit?customer_id={effectiveCustomerId}
          │     → billing_mode, invoice_amount, invoice_interval, invoice_interval_count loaded
          │
          ├── GET /stripe/client?customer_id={effectiveStripeId}
          │     → only fires if effectiveStripeId exists AND billing_mode === "automatic"
          │     → subscription, upcomingInvoice, invoices, paymentMethod loaded
          │
          ├── Tab: Staffing (default)
          │     → GET /assignments?customer_id={effectiveUserId}
          │     → team members rendered
          │
          └── Tab: Billing
                → StripeIdPanel always renders (or blocks everything else if no ID on file)
                → BillingModeToggle + InvoiceSettingsPanel render for admins (automatic mode only for the latter)
                → if manual: static "invoiced manually" card
                → if automatic: PendingBalance + NextPayment + Invoices + PaymentMethod, from the Stripe snapshot
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
| Open Stripe Customer Portal (add/update card) | POST | `/stripe/create-customer-portal` |
| Renew a canceled/unpaid/incomplete_expired subscription | POST | `/stripe/renew-subscription` |
| Cancel a subscription immediately | POST | `/stripe/cancel-subscription` |
| Get/set a customer's `stripe_customer_id` (admin-only edit) | PATCH | `/users?type=customer` |
| Get/set billing mode + invoice amount/frequency (admin-only edit; pauses/resumes Stripe collection and syncs the subscription price) | GET / PATCH | `/stripe-edit?customer_id={customerId}` |

---

## File Map

| File | Responsibility |
|---|---|
| `app/[slug]/(portal)/settings/page.tsx` | Page shell |
| `components/settings/settings-tabs.tsx` | Tab switcher — resolves effective IDs for admin, fetches billing-mode data and the Stripe snapshot |
| `components/settings/staffing-section.tsx` | Team members list + Request Change (Cal.com) button |
| `components/settings/developer-details-modal.tsx` | Popup shown when a team member card is clicked (name, role, date added, bio, tech stack) |
| `components/settings/add-developer-modal.tsx` | Customer-facing Add Developer modal (Internal creation + Spark & Co FDE request) |
| `components/settings/edit-internal-developer-modal.tsx` | Customer-facing edit modal for their own Internal developers (name, phone, bio, tech stack, weekly hours) |
| `components/shared/tech-stack-picker.tsx` | Shared drag-to-reorder tech stack chip editor (used here and by the admin Edit Developer Profile modal) |
| `components/settings/billing-section.tsx` | Billing layout, plus `StripeIdPanel`, `BillingModeToggle`, and `InvoiceSettingsPanel` (all defined inline in this file) |
| `components/settings/billing-panels/pending-balance.tsx` | Outstanding balance panel |
| `components/settings/billing-panels/next-payment-panel.tsx` | Subscription status badge, renew/cancel actions, next invoice date |
| `components/settings/billing-panels/invoices-panel.tsx` | Invoice history list with PDF download |
| `components/settings/billing-panels/payment-method-expand.tsx` | Payment card display + Stripe portal redirect |
| `supabase/functions/stripe-edit/index.ts` | Billing mode + invoice amount/frequency backend — pauses/resumes Stripe collection, syncs subscription price |
| `context/CustomerSlugContext.tsx` | Provides the customer slug when admin is previewing |
