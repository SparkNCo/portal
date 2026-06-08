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
| `admin` | `/{clientName}/dashboard/admin` | Always |
| `customer` | `/{clientName}/dashboard/client` | Always |
| `developer` | `/{assignment[0].clientName}/dashboard/developer` | Always |
| `stakeholder` | `/{assignment[0].clientName}/dashboard/client` | Requires at least one customer assignment |

> **Important for stakeholders:** If a stakeholder has no customer assignment yet, they cannot log in — they see the error: _"No client assigned to this account. Contact your administrator."_ The admin must assign them to a customer first (see `app/docs/ADMIN_FLOWS.md`).

The `clientName` used in the URL comes from the user's profile. For developers and stakeholders it comes from their first assignment (`assignment_id[0].clientName` or `assignment_id[0].linear_slug` as fallback).

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
| Email | Read-only | Pre-filled from the Supabase session, cannot be changed |
| First name | ✅ Yes | |
| Last name | ✅ Yes | |
| Client name / Username | ✅ Yes | For customers this becomes the URL slug (spaces → hyphens) |
| Phone number | No | Numbers and `+`, `-`, `(`, `)` only |
| New password | ✅ Yes | Min 8 characters |
| Confirm password | ✅ Yes | Must match |

### What happens on submit

Two things happen in sequence:

1. `supabase.auth.updateUser({ password })` — sets the password in Supabase Auth.
2. `PATCH /users` with `{ id, firstName, lastName, clientName, phoneNumber? }` — saves the profile data to the backend.

The `clientName` is slugified before saving (spaces replaced with hyphens). This slug is then used to build the redirect URL.

**Redirect after setup:**

| Role | Redirect |
|---|---|
| `customer` | `/{clientName}/dashboard/dashboards?customer={clientName}&panel=client` |
| Everyone else | `/{clientName}/dashboard/dashboards` |

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
