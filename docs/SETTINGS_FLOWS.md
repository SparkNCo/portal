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

Calls `GET /assignments?customer_id={userId}` to fetch all developers and stakeholders assigned to the customer. Each result row is mapped to a team member with: name, email, role, weekly hours (`allocation`), and join date.

### What it shows

Each team member appears as a card with:
- Avatar (initials)
- Name and email
- Role badge (always shown as `active`)
- Join date
- Weekly hour commitment (e.g. `20h/week`)
- A mail icon button (currently no action wired)

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

## File Map

| File | Responsibility |
|---|---|
| `app/[slug]/dashboard/(portal)/settings/page.tsx` | Page shell |
| `components/settings/settings-tabs.tsx` | Tab switcher — resolves effective IDs for admin, fetches billing data |
| `components/settings/staffing-section.tsx` | Team members list + Request Change (Cal.com) button |
| `components/settings/billing-section.tsx` | Billing layout — assembles all four billing panels |
| `components/settings/billing-panels/pending-balance.tsx` | Outstanding balance panel |
| `components/settings/billing-panels/next-payment-panel.tsx` | Next invoice date + canceled subscription state |
| `components/settings/billing-panels/invoices-panel.tsx` | Invoice history list with PDF download |
| `components/settings/billing-panels/payment-method-expand.tsx` | Payment card display + Stripe portal redirect |
| `context/CustomerSlugContext.tsx` | Provides the customer slug when admin is previewing |
