# Chat — Flows & How It Works

> Reference for the standalone Chat page and CometChat integration.
> Customer/stakeholder page: `app/[slug]/(portal)/chat/page.tsx` → `CometChatPage`
> Developer's own page: `app/dev/chat/page.tsx` → `DevChatPage`
> Admin's own page: `app/admin/chats/page.tsx` → `AdminChatPage` (unscoped inbox across every customer)

All three pages render the same `ChatLayout` component — they only differ in what slug/customer scope gets passed in. **Admin and developer routes carry no customer slug at all** (`/admin/chats`, `/dev/chat` — fixed paths, not `/{slug}/chat`), matching the same slug-less routing used for their dashboards (see `app/docs/LOGIN_FLOWS.md` and `app/docs/DEVELOPER_DASHBOARD_FLOWS.md`). Only customer/stakeholder chat is slug-based, since only those roles are scoped to one customer.

---

## Who sees this page

Chat is accessible to `customer`, `developer`, `stakeholder`, and `admin`. All four roles have it in their sidebar, labeled "Chat" — linking to `chat` (resolved relative to the current route: `/{slug}/chat` for customer/stakeholder, `/dev/chat` for developer) and to `chats` for admin's own top-level nav (`components/sidebar.tsx`).

There are two distinct chat surfaces in the app:
- **This page** (`/{slug}/chat`, `/dev/chat`, or `/admin/chats`) — the full standalone chat experience with a sidebar and conversation view.
- **Issue chat** (`IssueCometChat`) — the Chat tab embedded inside the Issue Detail Modal, scoped to a single issue. See "Issue Chat" below and `app/docs/FEATURES_FLOWS.md`.

**A fourth route reuses the same page:** the admin **Dashboards** preview (`components/dashboard/panel-renderer.tsx`, `case "chat"`) renders the identical `ChatPage` (the `/[slug]/(portal)/chat` one) while previewing one specific customer — `CustomerSlugContext` resolves to that customer's slug instead of the admin's own, which is what scopes the inbox down to just that customer (see "Scoping to a single customer" below).

---

## CometChat initialization — `initCometChatUser`

**Source:** `components/chat/CometChat/initCometChatUser.ts` — shared by both `useCometChat` (this page) and `IssueCometChat` (issue chat), so login/session logic only lives in one place.

1. **Init SDK** — `CometChat.init(APP_ID, settings)` with the app credentials from `constants.ts`.
2. **Get Supabase user** — retrieves the current auth session from Supabase; throws if not logged in.
3. **Resolve the CometChat session** using the Supabase user's `id` as the CometChat UID:
   - Already logged in as that same UID → reuse the session as-is.
   - Logged in as a *different* UID → `CometChat.logout()` first.
   - Not logged in (or just logged out above) → `CometChat.login()`; if that fails with `ERR_UID_NOT_FOUND`, creates the CometChat user first (name set to the Supabase user's email) and logs in again.

If anything fails, the caller shows an error message instead of the chat UI.

---

## `useCometChat(customerId?)` — this page's group list

**Source:** `components/chat/CometChat/useCometChat.ts`

Calls `initCometChatUser()` on mount, then fetches the group list:

- **Pagination:** `GroupsRequestBuilder` fetches 50 groups per page, looping up to 20 pages (bounded so a misbehaving request can't spin forever) until a page comes back short or empty.
- **Who sees which groups:** admins fetch every public group (no `joinedOnly` filter); everyone else fetches only groups they've joined.
- **Optional `customerId` scoping:** when a `customerId` is passed in (see "Scoping to a single customer" below), the fetched list is filtered down to groups whose `customerId` metadata matches. Passing `undefined` returns the caller's normal unscoped inbox. Changing `customerId` re-filters without re-running the CometChat login.

**Leaving a chat (`leaveGroup`):** calls `CometChat.leaveGroup(guid)` — this actually removes the caller as a member in CometChat, not just a local/UI hide. The group itself and its message history are untouched for everyone else, including admins (who list all public groups regardless of membership, so a group an admin can't personally leave still shows up for them).

**Creating a group (`createSupportGroup(title, groupCustomerId?, projectSlug?)`):**
1. Always adds the creator and, if configured, a fixed staff account (`NEXT_PUBLIC_COMET_ADMIN_UID`, `SUPPORT_OWNER_UID`) as members.
2. Member/customer resolution depends on the creator's role:
   - **Customer:** `GET /assignments?customer_id={profile.id}` → adds every assigned developer and stakeholder. `resolvedCustomerId` is the customer's own id.
   - **Stakeholder:** `GET /assignments?developer={profile.id}` → finds their assigned customer, then `GET /assignments?customer_id={customerId}&onlyDev=true` → adds that customer's developers. `resolvedCustomerId` is the found customer's id.
   - **Admin/developer creating on behalf of a customer** (Dashboards preview flow): `groupCustomerId` is passed in directly from the viewed customer's id instead of being derived from the creator.
3. Any member UID not yet known to CometChat gets created (`CometChat.createUser`) before the group is made.
4. Group GUID: `customer_{profile.id}_{timestamp}`. Type `PUBLIC`. Metadata: `{ customerId: resolvedCustomerId, projectSlug }` — `customerId` powers the admin customer filter and the Dashboards-preview scoping; `projectSlug` powers the sidebar's collapsible-by-project grouping.
5. **Ownership transfer:** CometChat makes whoever calls `createGroupWithMembers` the group's owner, and an owner can't leave a group without transferring ownership first (`ERR_OWNER_EXIT_FORBIDDEN`). Right after creation, ownership is handed off to the fixed staff account (`SUPPORT_OWNER_UID`) so the customer/stakeholder who started the chat can leave it later without hitting that error.

---

## Page layout — `ChatLayout`

**Source:** `components/chat/CometChat/ChatLayout.tsx`

Props: `initialTitle` (from `?newChat=`) and `fallbackProjectSlug` (the caller's own `[slug]` route segment, if it has one — only the customer/stakeholder `/{slug}/chat` page passes one; `/admin/chats` and `/dev/chat` both omit it, since neither admin nor developer has a personal slug).

The layout is a two-panel split: a sidebar on the left and a chat area on the right.

**Mobile behaviour:** only one panel is visible at a time. The sidebar shows by default. Selecting a chat hides the sidebar and shows the conversation. A "Back to chats" button at the top returns to the sidebar.

**Desktop behaviour:** both panels are visible side by side.

### Scoping to a single customer

`customerId` passed to `useCometChat` comes from `useCustomerSlug()` (`CustomerSlugContext`) combined with `usePinnedPanelsOwnerId()`:
- On a plain `/chat` visit (no customer being previewed), `customerSlug` is empty, so `customerId` stays `undefined` — the inbox is unscoped, showing the caller's own chats (or, for admin, everything).
- Inside the Dashboards preview (`customerSlug` set to the previewed customer's slug), `usePinnedPanelsOwnerId()` resolves that slug to the customer's actual portal user id (matched against `clientName`, normalized) — the inbox is filtered to just that customer's groups.

### Admin customer filter

Separately from the above, `ChatLayout` also gives admins a **manual** filter dropdown (independent of Dashboards-preview scoping) that narrows the *unscoped* `/admin/chats` inbox down to one customer at a time:
1. Fetches every user (`GET /users`) and keeps `role === "customer"` entries with a name, for the dropdown options.
2. Selecting one filters `groups` client-side by each group's `customerId` metadata (`selectedCustomerId` state, empty = "All customers").

### Auto-open `CreateChatModal`

Fires once `ready` is true **only** if the URL has a `?newChat={title}` query param (navigated from an issue card's chat icon) — the title field is pre-filled from it, and the param is cleared from the URL once the user interacts. There is no longer an automatic open for "customer with zero chats"; a customer with no chats sees the empty state and uses the New Chat button.

### Leaving a chat

`canLeaveChats` is `false` for admins (chats need to stay readable/auditable by admins) and `true` for every other role. When allowed, hovering a group row's ✕ calls `leaveGroup` (see above — this is a real CometChat membership removal, not just hiding the row).

---

## Sidebar — `ChatSideBar`

**Source:** `components/chat/CometChat/ChatSideBar.tsx`

The sidebar lists two types of conversations, plus (admin-only) a customer filter select at the top:

### Group chats

Groups are displayed as rows with an avatar (initials), and group name.

If groups span more than one `projectSlug` (stored in the group's metadata), they are **grouped into collapsible sections** by project slug — similar to how documents are grouped by project. If all groups belong to the same project, sections are hidden and groups are shown flat.

The active group is highlighted with an accent left border. When `canLeaveChats` is true, hovering a group row shows an ✕ button to leave that chat (see `leaveGroup` above — real membership removal, not a local-only hide).

### Direct chats (AI Agent)

`ChatSideBar` and `DirectChat.tsx` still fully support a list of AI-agent direct conversations (bot icon, title, "AI Agent" subtitle, its own message thread via `CometChat.RECEIVER_TYPE.USER`) — but nothing in the current UI actually creates a new entry in that list. `ChatLayout`'s `directChats` state starts empty and is only ever read from or filtered (on close); no button or flow calls `setDirectChats` to add one. Functionally dead today, not removed.

### New Chat button

A **"New Chat"** button sits at the bottom of the sidebar, visible to all users. The `+New` button also appears in the header, but only for customers (`isCustomer` check). Both open the `CreateChatModal`.

---

## Creating a new group chat — `CreateChatModal`

**Source:** `components/chat/CometChat/CreateChatModal.tsx`

A modal with a single text input for the chat title. The user types the title and clicks **Create** (or presses Enter). Submitting calls `ChatLayout`'s `handleCreate`, which calls `createSupportGroup(title, customerId, projectSlug)` (see `useCometChat` above for what that assembles), then refreshes the group list and selects the new group.

`projectSlug` passed here is `customerSlug ?? fallbackProjectSlug` — the previewed customer's slug takes priority over the caller's own route slug, so a group created while an admin/developer is previewing a customer's Dashboards panel gets tagged with *that customer's* slug, not the viewer's own.

---

## Opening chat from an issue card

When a user clicks the chat icon on an issue card in the Priority Tasks list, the app navigates to the chat page with the issue pre-selected as a new chat title:

```
/acme/dashboard  →  /acme/chat?newChat=SPA-42%20Fix%20login%20bug
```

The `?newChat` param is passed to `ChatLayout` as `initialTitle`, which pre-fills the `CreateChatModal` title field and opens it automatically.

---

## Issue Chat — `IssueCometChat` (per-issue, embedded in the modal)

**Source:** `components/chat/CometChat/IssueCometChat.tsx` → `IssueGroupChat.tsx` + `getOrCreateIssueGroup.ts`. Rendered from the Chat tab in `issue-detail-modal.tsx` as `<IssueCometChat issueId issueTitle slug />` (`slug` is the issue's customer, threaded through so a brand-new group can be tagged correctly even when a developer/admin — not the customer — sends the first message).

Unlike the standalone Chat page, this is **lazy**: opening the tab never creates a group or adds members by itself.

1. **On open:** `getExistingIssueGroup(issueId)` looks up the deterministic GUID `issue_{sanitized issueId}` — if a group already exists (someone messaged before), it's loaded and joined; if not, the tab renders with `group = null` and an empty "No messages yet. Start the conversation." state, with no CometChat group created yet and no members added.
2. **On first send** (`onCreateGroup`, only invoked if no group exists yet): `getOrCreateIssueGroup` builds the group:
   - Member resolution depends on the **sender's** role: customer/stakeholder follow the same assignment lookups as `createSupportGroup` above. A developer/admin sending the first message instead resolves the issue's customer via the `slug` prop — matched against `clientName` (normalized) — and adds that customer plus their assigned developers.
   - **Name collision handling:** if another group already has the issue's title, the name gets " 2", " 3", … appended until it's unique (`resolveGroupName`).
   - Ownership is transferred to the fixed staff account (`SUPPORT_OWNER_UID`) right after creation, same rationale as `createSupportGroup`.
   - Concurrent creation for the same issue is de-duped via an in-memory `groupCreationInFlight` map, so two near-simultaneous first messages can't create two groups.
3. While the group is being created, the message list shows a "Creating chat and adding users…" inline loader (`ChatSpinner`/`Loader2`) instead of the empty state.
4. Once a group exists, behaviour matches the standalone `GroupChat`: real-time listener, 50-message history, join-on-first-view.

Messages render via the shared `MessageBubble` (compact mode here), with initials avatars (`MessageAvatar`), sender name, and timestamp.

---

## Full data flow on page load (standalone Chat page)

```
User lands on /{slug}/chat, /dev/chat, /admin/chats, or the Dashboards "chat" panel
          │
          ├── initCometChatUser()
          │     → CometChat.init, resolve Supabase user, login/create-if-missing
          │
          ├── customerId = customerSlug ? resolve-slug-to-customer-id : undefined
          │
          ├── fetchGroups(customerId)  (paginated; joined-only unless admin; filtered if customerId set)
          │     → groups list populated in sidebar
          │
          ├── ready = true → UI renders
          │
          ├── if ?newChat param → CreateChatModal auto-opens, pre-filled
          │
          └── User selects a group
                → GroupChat renders in the right panel
                → real-time message listener attached
```

---

## File Map

| File | Responsibility |
|---|---|
| `app/[slug]/(portal)/chat/page.tsx` | Page entry for customer/stakeholder (and admin previewing a customer via Dashboards) — reads `?newChat`, wraps in Suspense, passes `fallbackProjectSlug` |
| `app/dev/chat/page.tsx` | Developer's own unscoped Chat page (`/dev/chat`) — same `ChatLayout`, no `fallbackProjectSlug` |
| `app/admin/chats/page.tsx` | Admin's own unscoped Chat page (`/admin/chats`) — same `ChatLayout`, no `fallbackProjectSlug` |
| `components/dashboard/panel-renderer.tsx` | Renders the same `ChatPage` inside the Dashboards customer-preview panel (`case "chat"`) |
| `components/chat/CometChat/ChatLayout.tsx` | Two-panel layout, customer scoping/filter, group selection state, auto-open modal logic |
| `components/chat/CometChat/ChatSideBar.tsx` | Sidebar — group list (grouped by projectSlug), direct chats, admin customer filter |
| `components/chat/CometChat/useCometChat.ts` | Group fetching/pagination, group creation (`createSupportGroup`), `leaveGroup` |
| `components/chat/CometChat/initCometChatUser.ts` | Shared CometChat SDK init + login/create-user logic (used here and by `IssueCometChat`) |
| `components/chat/CometChat/CreateChatModal.tsx` | New chat modal with title input |
| `components/chat/CometChat/GroupChat.tsx` | Standalone-page group conversation view and message sender |
| `components/chat/CometChat/DirectChat.tsx` | AI agent direct conversation view — UI/logic intact but currently unreachable (nothing creates a `directChats` entry) |
| `components/chat/CometChat/IssueCometChat.tsx` | Embedded issue chat entry point (used in `IssueDetailModal`) — looks up an existing group without creating one |
| `components/chat/CometChat/getOrCreateIssueGroup.ts` | Lazy issue-group creation (on first message only), name de-dup, ownership transfer, in-flight de-dupe |
| `components/chat/CometChat/IssueGroupChat.tsx` | Issue chat's conversation view — triggers lazy group creation on first send, shows the "Creating chat…" loader |
| `components/chat/CometChat/ChatSpinner.tsx` | Shared loading spinner (sm/md) used across the chat surfaces |
| `components/chat/CometChat/MessageBubble.tsx` / `MessageAvatar.tsx` | Shared message rendering (compact mode for issue chat) |
| `components/chat/CometChat/chatUtils.ts` | `extractChatMessage`/`formatMessageTime` helpers shared by `MessageBubble` and `DirectChat` |
| `components/chat/CometChat/constants.ts` | CometChat APP_ID, REGION, AUTH_KEY |
| `components/chat/CometChat/Chat.tsx`, `ConversationChat.tsx`, `StaffChatInput.tsx`, `Provider.tsx` | Earlier unified-inbox prototype (`mode: "response" \| "ai" \| "staff"`) — not imported by any page or route today; dead code, left in place |
