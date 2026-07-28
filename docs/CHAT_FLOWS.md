# Chat — Flows & How It Works

> Reference for the standalone Chat page and CometChat integration.  
> Main page: `app/[slug]/(portal)/chat/page.tsx` → `CometChatPage`

---

## Who sees this page

Chat is accessible to `customer`, `developer`, and `stakeholder`. All three roles have it in their sidebar. Admins also have it.

There are two distinct chat surfaces in the app:
- **This page** (`/chat`) — the full standalone chat experience with a sidebar and conversation view.
- **Issue chat** (`IssueCometChat`) — the Chat tab embedded inside the Issue Detail Modal, scoped to a single issue. Documented in `app/docs/FEATURES_FLOWS.md`.

---

## CometChat initialization — `useCometChat`

**Source:** `components/chat/CometChat/useCometChat.ts`

Every time the chat page loads, the `useCometChat` hook initialises the CometChat SDK. The sequence is:

1. **Init SDK** — calls `CometChat.init(APP_ID, settings)` with the app credentials from `constants.ts`.
2. **Get Supabase user** — retrieves the current auth session from Supabase.
3. **Login to CometChat** — uses the Supabase user's `id` as the CometChat UID:
   - If already logged in as the same user → reuse the session.
   - If logged in as a different user → logout first, then login.
   - If the UID doesn't exist in CometChat yet (`ERR_UID_NOT_FOUND`) → creates a new CometChat user (name set to the user's email), then logs in.
4. **Fetch groups** — loads all CometChat groups the user belongs to.
   - Admins fetch all groups (not filtered to joined-only).
   - Everyone else fetches only groups they have joined.
5. Sets `ready = true` — the UI renders.

If anything fails, an error message is shown instead of the chat UI.

---

## Page layout — `ChatLayout`

**Source:** `components/chat/CometChat/ChatLayout.tsx`

The layout is a two-panel split: a sidebar on the left and a chat area on the right.

**Mobile behaviour:** only one panel is visible at a time. The sidebar shows by default. Selecting a chat hides the sidebar and shows the conversation. A "Back to chats" button at the top returns to the sidebar.

**Desktop behaviour:** both panels are visible side by side.

### Auto-open modal logic

When the chat page first loads (`ready` becomes true), the `CreateChatModal` opens automatically in two cases:
1. The URL has a `?newChat={title}` query param (navigated from an issue card's chat icon).
2. The user is a **customer**, has no groups and no direct chats yet.

In case 1, the title field is pre-filled with the value from the URL. The `?newChat=` param is cleared from the URL once the user interacts.

---

## Sidebar — `ChatSideBar`

**Source:** `components/chat/CometChat/ChatSideBar.tsx`

The sidebar lists two types of conversations:

### Group chats

Groups fetched from CometChat are displayed as rows with an avatar (initials), group name, and member count.

If groups span more than one `projectSlug` (stored in the group's metadata), they are **grouped into collapsible sections** by project slug — similar to how documents are grouped by project. If all groups belong to the same project, sections are hidden and groups are shown flat.

The active group is highlighted with an accent left border. Hovering a group row shows an ✕ button to leave/close that chat from the sidebar (it does not delete the group from CometChat, just removes it from the local view).

### Direct chats (AI Agent)

The `directChats` list shows AI agent conversations. Each entry displays a bot icon, the conversation title, and "AI Agent" as the subtitle. These are added to the sidebar when a user starts a direct conversation with an AI agent.

### New Chat button

A **"New Chat"** button sits at the bottom of the sidebar, visible to all users. The `+New` button also appears in the header, but only for customers (`isCustomer` check). Both open the `CreateChatModal`.

---

## Creating a new group chat — `CreateChatModal`

**Source:** `components/chat/CometChat/CreateChatModal.tsx`

A modal with a single text input for the chat title. The user types the title and clicks **Create** (or presses Enter).

Behind the scenes, `createSupportGroup(title, projectSlug)` in `useCometChat` assembles the group members automatically based on the user's role:

**If the user is a `customer`:**
1. Fetches all their assignments → `GET /assignments?customer_id={profile.id}`
2. Adds every assigned developer and stakeholder as a group member.

**If the user is a `stakeholder`:**
1. Finds the customer they're assigned to → `GET /assignments?developer={profile.id}`
2. Adds that customer as a member.
3. Fetches all developers assigned to that customer → `GET /assignments?customer_id={customerId}&onlyDev=true`
4. Adds those developers as members.

For any member UID that doesn't yet exist in CometChat, a new CometChat user is created automatically before the group is made.

The group is created with:
- A unique GUID: `customer_{profile.id}_{timestamp}`
- Type: `PUBLIC`
- Metadata: `{ projectSlug }` (the current URL slug) — used for sidebar grouping

After creation, the groups list refreshes and the new group is selected automatically.

---

## Opening chat from an issue card

When a user clicks the chat icon on an issue card in the Priority Tasks list, the app navigates to the chat page with the issue pre-selected as a new chat title:

```
/acme/dashboard  →  /acme/chat?newChat=SPA-42%20Fix%20login%20bug
```

The `?newChat` param is passed to `ChatLayout` as `initialTitle`, which pre-fills the `CreateChatModal` title field and opens it automatically.

---

## Full data flow on page load

```
User lands on /{slug}/chat
          │
          ├── CometChat.init(APP_ID)
          │
          ├── supabase.auth.getUser()
          │     → resolve UID
          │
          ├── CometChat.login(uid, AUTH_KEY)
          │     → if UID not found → CometChat.createUser() → login
          │
          ├── fetchGroups()  (joined-only, unless admin)
          │     → groups list populated in sidebar
          │
          ├── ready = true → UI renders
          │
          ├── if ?newChat param OR (customer with no chats)
          │     → CreateChatModal auto-opens
          │
          └── User selects a group
                → GroupChat renders in the right panel
                → real-time message listener attached
```

---

## File Map

| File | Responsibility |
|---|---|
| `app/[slug]/(portal)/chat/page.tsx` | Page entry — reads `?newChat` param, wraps in Suspense |
| `components/chat/CometChat/ChatLayout.tsx` | Two-panel layout, group selection state, auto-open modal logic |
| `components/chat/CometChat/ChatSideBar.tsx` | Sidebar — group list, direct chats, grouped by projectSlug |
| `components/chat/CometChat/useCometChat.ts` | SDK init, login, group fetching, group creation logic |
| `components/chat/CometChat/CreateChatModal.tsx` | New chat modal with title input |
| `components/chat/CometChat/GroupChat.tsx` | Group conversation view and message sender |
| `components/chat/CometChat/DirectChat.tsx` | AI agent direct conversation view |
| `components/chat/CometChat/IssueCometChat.tsx` | Embedded issue chat (used in IssueDetailModal, not this page) |
| `components/chat/CometChat/constants.ts` | CometChat APP_ID, REGION, AUTH_KEY |
