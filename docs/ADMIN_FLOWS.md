# Admin Panel — Flows & How It Works

> Reference file for the portal's administration panel.  
> Main page: `app/admin/users/page.tsx` → `AdminUsersPage`

---

## Access & Security

The admin panel is only accessible to users with `role === "admin"`.  
If anyone tries to open it with a different role, the component renders a "Not authorized" message and stops there.  
The role comes from the global `UserContext`, which loads the user profile from Supabase on login.

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

On confirm, calls `POST /users?type=developer` with `{ email, role: "developer", origin, ...optionalFields }`.  
The `origin` field is the portal's URL (e.g. `https://app.sparkco.io`), which the backend uses to build the invitation link in the welcome email.

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

---

## File Map

| File | Responsibility |
|---|---|
| `app/admin/users/page.tsx` | Main page — Users and Projects views |
| `app/admin/users/AddDeveloperModal.tsx` | Modal to create a developer |
| `app/admin/users/AddClientModal.tsx` | Modal to create a customer |
| `app/admin/users/AddStakeholderModal.tsx` | Modal to create a stakeholder |
| `app/admin/users/AssignCustomerModal.tsx` | Modal to assign a developer/stakeholder to a customer |
| `context/UserContext.tsx` | Provides `profile.role` for access control |
