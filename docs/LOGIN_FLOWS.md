# Login & Authentication Flows

> Reference for how users get into the portal — from first-time setup to everyday login to password recovery.  
> Entry point: `app/page.tsx` → renders `<LoginForm />` from `app/login/Login.tsx`

---

## Overview of all authentication routes

| Route | Purpose |
|---|---|
| `/` | Login page — shown to everyone who is not authenticated |
| `/set-password` | First-time setup — new users arriving via invitation email |
| `/reset-password` | Password reset — users arriving via a "forgot password" email link |

---

## 1. Login Flow

### What the user sees

The login page shows a centered card with the SparkCo logo, an email input (labeled "Username"), a password input, a "Forgot your password?" link, and a Login button.

### What happens step by step

**Step 1 — Supabase authentication**

When the user submits the form, `supabase.auth.signInWithPassword({ email, password })` is called.  
If Supabase returns an error (wrong password, user doesn't exist, etc.), the error message is shown on screen and the flow stops.

**Step 2 — Fetch the user profile**

If Supabase authentication succeeds, the app immediately calls `GET /users?email={email}` to load the user's full profile from the backend — including their role and assignment data.

**Step 3 — Role-based redirect**

Once the profile loads, the app redirects the user to their corresponding dashboard based on their role:

| Role | Redirect destination | Condition |
|---|---|---|
| `admin` | `/admin/users` | Always |
| `customer` | `/{clientName}/dashboard` | Always |
| `developer` | `/{slug}/developer` — last initiative picked in "Working on", else their first assignment (`/dev/developer` if they have none) | Always |
| `stakeholder` | `/{assignment[0].clientName}/dashboard` | Requires at least one customer assignment |

> **Important for stakeholders:** If a stakeholder has no customer assignment yet, they cannot log in — they see the error: _"No client assigned to this account. Contact your administrator."_ The admin must assign them to a customer first (see `app/docs/ADMIN_FLOWS.md`).

**Admin pages carry no customer slug** — they're fixed paths (`/admin/*`), since admins aren't tied to a single customer; they open a customer's pages by picking it in the sidebar's Initiative dropdown. Customers, stakeholders and developers land on slug-based `/{slug}/*` routes: customers use their own `clientName`, stakeholders their first assignment (`assignment_id[0].clientName`/`assignment_id[0].linear_slug`), and developers the initiative chosen as described below.

#### Who can open which `/{slug}` page

Every `/{slug}/…` page goes through an access check in its layout (`app/[slug]/(portal)/layout.tsx`, rules in `lib/route-access.ts`) before anything renders:

| Role | Can open |
|---|---|
| `admin` | Any `/{slug}` |
| `customer` | Only their own initiative (`clientName`) |
| `stakeholder` | Only initiatives they're assigned to |
| `developer` | Only initiatives they're assigned to |

- **No access:** the user is sent to their own home page (customer/stakeholder dashboard, developer's `/{slug}/developer`) with the toast _"You don't have access to that initiative."_

Some pages inside an initiative are also limited by role (`PAGE_ROLES` in `lib/route-access.ts`); every other page is open to anyone who can open the initiative:

| Page | Roles |
|---|---|
| `/{slug}/developer` | `developer` only |
| `/{slug}/settings` | `admin`, `customer`, `stakeholder` (not developers) |

Opening one of those with another role sends the user to that initiative's main page (`/{slug}/developer` for developers, `/{slug}/dashboard` for everyone else) with the toast _"That page isn't available for your role."_
- **No portal profile, an unrecognised role, or nowhere valid to land** (e.g. a customer with no linked client): an _"Your account isn't set up yet"_ screen with a Log out button, instead of the page (`components/account-not-set-up.tsx`).
- Slugs are compared case-insensitively, against the initiative's `clientName` (or `linear_slug`, for older links).
- **Front-end only:** this controls what the app shows. The edge functions don't check who is calling yet, so the data itself isn't protected by this.

**Login with an unrecognised role, or as a customer with no linked client,** shows _"Your account isn't set up yet. Contact your administrator."_ on the login form and signs the user out, instead of redirecting to `/undefined/dashboard`.

#### Developers with more than one assignment

A developer can be assigned to several initiatives, so login has to pick one. `app/login/Login.tsx` calls `developerPanelPath(profile, "developer", selectedProject)` (`lib/developer-routes.ts`), which resolves the initiative in this order:

1. **The initiative they last worked on in this browser.** It's the value of the sidebar's "Working on" dropdown, stored in `localStorage` under `dev-selected-project` (`lib/selected-project-context.tsx`). It's saved when the developer picks a project in the dropdown, and also whenever they open any `/{slug}/…` page of one of their initiatives (the sidebar syncs the dropdown with the URL). It's only used if it's still one of their current assignments; the match ignores case.
2. **Otherwise, their first assignment.**
3. **No assignments:** `/dev/developer`, which shows "No assigned projects yet".

The destination is `/{clientName lowercased}/developer`, e.g. `/spark-portal/developer`.

| Situation | Lands on |
|---|---|
| Assigned to Spark-Portal and LuaLink, last worked on LuaLink in this browser | `/lualink/developer` |
| First login in this browser (or another computer, or cleared site data) | `/{first assignment}/developer` |
| No longer assigned to the stored initiative | `/{first assignment}/developer` |
| No assignments | `/dev/developer` → "No assigned projects yet" |

**Caveats:**

- **Remembered per browser, not per user.** Another device or a cleared browser falls back to the first assignment.
- **"First assignment" has no guaranteed order.** The assignments come from `GET /users?email=`, which loads them with `.in("id", assignment_id)` and no `order by` (`supabase/functions/users/index.ts`). In practice the order is stable, but the database doesn't promise it. Ordering that query (e.g. by `joined` or `allocation`) would make it predictable.
- **After set-password** the profile with assignments isn't loaded yet, so the redirect goes to `/dev/developer`, which forwards to `/{slug}/developer` once it is (`components/dev-route-redirect.tsx`), using the same order as above.


> **Admin/developer redirect history:** admin's redirect used to be slug-based too — first `` /${customer.clientName}/admin `` (broken: `clientName` only populates when a user has a `customer_id`, which admins never do, so it always resolved to `/null/admin`), then `customer.userName` as a stand-in slug (`/{userName}/admin` → `/{userName}/users`, requiring every admin account to have a `userName` set). Developer's redirect was similarly `/{assignment[0].clientName}/developer`. Admin's was replaced by the fixed `/admin/users`. Developer's moved to a slug-less `/dev/developer` for a while and is now `/{slug}/developer` again, picked by `lib/developer-routes.ts` (last "Working on" choice, else first assignment). See `app/docs/DEVELOPER_DASHBOARD_FLOWS.md` and `app/docs/CHAT_FLOWS.md` for how this ripples into the developer dashboard and chat.

---

## 2. Forgot Password Flow

This flow is triggered entirely from within the login page — no separate route is needed to start it.

### Step 1 — Open the modal

The user clicks "Forgot your password?" on the login form. A modal overlays the login page with an email input and a "Send link" button.

### Step 2 — Request the reset email

The user types their email and clicks "Send link".  
The app calls `POST /reset-password` with `{ email }`.

If the request succeeds, the modal switches to a confirmation screen:  
_"A password reset link has been sent to [email]."_

If it fails, an error message appears inside the modal. The user can try again without closing it.

### Step 3 — User clicks the link in their email

The email contains a link pointing to `/reset-password` with a special token embedded in the **URL hash** (e.g. `#access_token=...`). Supabase sends this link automatically once the backend triggers the reset.

### Step 4 — Reset password page (`/reset-password`)

The page reads the URL hash to determine the state:

**If the link is expired or invalid** (`error_code=otp_expired` or `error=access_denied` in the hash):  
→ Shows "Link expired" with a button to go back to login.

**If the link is valid:**  
→ The page listens for the `PASSWORD_RECOVERY` event from Supabase's auth state listener. Once that event fires, the form becomes active and the user can type a new password.

The form requires:
- New password (min 6 characters, with show/hide toggle)
- Confirm password (must match)

On submit, `supabase.auth.updateUser({ password })` is called. On success, the page shows "Password updated!" and automatically redirects to `/` (login) after 3 seconds.

---

## 3. First-Time Setup Flow — New User Invitation

This is a **different flow** from forgot password. It applies to brand-new users who were just created by the admin and clicked the invitation link in their welcome email.

### Route: `/set-password`

The invitation email link takes the user directly to `/set-password`. The page detects the Supabase session from the URL token automatically via `supabase.auth.onAuthStateChange` listening for `SIGNED_IN` or `INITIAL_SESSION` events.

Once the session is detected, the page fetches the user's record from the Supabase `users` table to pre-populate any fields the admin already filled in (first name, last name, client name, phone).

### What the form collects

| Field | Required | Notes |
|---|---|---|
| Email | Read-only | Pre-filled from the Supabase session, cannot be changed. Shown as a plain label (icon + text), not an input. |
| Client name / Username | ✅ Yes | **Customers:** read-only — pre-filled from `userName` (set by the admin when the account was created) and shown as a label, not editable here. **Everyone else (developer/admin):** a regular editable "User name" input. Either way, this becomes the URL slug (spaces → hyphens). |
| First name | ✅ Yes | |
| Last name | ✅ Yes | |
| Phone number | No | Numbers and `+`, `-`, `(`, `)` only |
| New password | ✅ Yes | Min 8 characters |
| Confirm password | ✅ Yes | Must match |

### What happens on submit

Three things happen in sequence:

1. `supabase.auth.updateUser({ password })` — sets the password in Supabase Auth.
2. `PATCH /users` with `{ id, firstName, lastName, userName, phoneNumber? }` — saves the profile data to the backend. Note the field is `userName`, not `clientName`, and it's already slugified (spaces replaced with hyphens) before this call.
3. **Customers only:** `PATCH /users?type=customer` with `{ customer_id, clientName }` — syncs the (unchanged, since it isn't editable for customers) name onto their `customers` row too, keeping `users.userName` and `customers.clientName` in sync. If this call fails, the error shown is "Password set, but could not save the client name."

The slugified name from step 2 is what's used to build the redirect URL.

**Redirect after setup** — same destinations as the regular login redirect (see section 1's "Admin/developer redirect history"):

| Role | Redirect |
|---|---|
| `customer` | `/{clientName}/dashboard` |
| `admin` | `/admin/users` |
| `developer` | `/dev/developer`, which forwards to `/{slug}/developer` for their first initiative once the profile loads |
| Anyone else (e.g. `stakeholder`) | `/{clientName}/dashboard/dashboards` |

After redirecting, `reloadUser()` is called to refresh the global user context so the rest of the app has the updated profile immediately.

---

## Full Flow Comparison

```
New user (invitation)                Returning user               Forgot password
─────────────────────                ──────────────               ───────────────
Admin creates account          →     Visit /                  →   Click "Forgot password?"
                               │                              │
Receives invitation email      │     Enter email + password   │   Enter email in modal
                               │                              │
Clicks link → /set-password    │     Supabase auth            │   POST /reset-password
                               │                              │
Sets name + password           │     GET /users?email=...     │   Receives email
                               │                              │
PATCH /users saves profile     │     Role-based redirect      │   Clicks link → /reset-password
                               │                              │
Redirect to dashboard          │     Dashboard loaded         │   Sets new password
                                                              │
                                                              │   Redirect to /
```

---

## Error states

| Situation | What the user sees |
|---|---|
| Wrong email or password | Error message below the password field |
| Supabase session not found after login | "User session not found" |
| Stakeholder with no assignment | "No client assigned to this account. Contact your administrator." |
| Reset email request fails | Error message inside the forgot password modal |
| Reset link is expired | "Link expired" screen with a back-to-login button |
| Passwords don't match (reset or set-password) | "Passwords do not match." |
| Password too short (reset: 6 chars, set-password: 8 chars) | Minimum length error message |
| Profile save fails after password set | "Password set, but could not save your profile." |
| Customer's client-name sync fails after password set | "Password set, but could not save the client name." |

---

## File Map

| File | Responsibility |
|---|---|
| `app/page.tsx` | Entry point — renders LoginForm |
| `app/login/Login.tsx` | Login form + forgot password modal logic |
| `app/reset-password/page.tsx` | Password reset page (for forgot password link) |
| `app/set-password/page.tsx` | First-time profile + password setup (for invitation link) |
| `context/UserContext.tsx` | Holds the authenticated profile, provides `reloadUser()` |
| `lib/supabase-client.ts` | Supabase client used for auth operations |
