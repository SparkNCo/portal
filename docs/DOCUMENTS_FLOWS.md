# Documents — Flows & How It Works

> Reference for the Documents page, document requests, and all their panels.
> Customer/stakeholder (and admin previewing a customer): `app/[slug]/(portal)/documents/page.tsx` → `DocumentsPage`
> Developer's own page: `app/dev/documents/page.tsx` → re-exports the same `DocumentsPage` (no slug)

Both routes render the identical component — same slug-less-for-admin/developer pattern used by the Developer Dashboard and Chat (see `app/docs/DEVELOPER_DASHBOARD_FLOWS.md`, `app/docs/CHAT_FLOWS.md`).

---

## Who sees this page

Documents is accessible to `customer`, `stakeholder`, `developer`, and `admin` (while previewing a customer via Dashboards). It's the same page for everyone, but **what renders differs sharply by role** — this isn't just a permission-per-document thing anymore (see "Role-based panels" below).

---

## Resolving which customer/project this page is about

Two different slug-like values get resolved on every load, and they are **not the same thing**:

**`slug`** — the clientName-based route/customer slug, resolved in priority order: the previewed customer's slug (`useCustomerSlug()`, set when an admin/developer is inside the Dashboards preview) → the `[slug]` URL param (customer/stakeholder's own route) → `profile.linear_slug` → the caller's first assignment's `clientName` → that assignment's `linear_slug` → `""`. The assignment fallbacks are what let `/dev/documents` (no URL slug at all) resolve to *a* customer for a developer.

**`projectSlug`** — the actual Linear project slug used to scope `documents.project_slug` in storage queries and uploads. Resolved differently depending on role:
- **Admin:** looked up from a `GET /users?type=customers` list, matching `clientName === slug` — admins are never in anyone's `assignment_id`, so they can't resolve it any other way. Rendering is withheld (`projectSlugPending`) until this resolves, rather than fetching with `projectSlug=undefined` (which would return every document the admin can see, not just this customer's).
- **Everyone else:** `profile.assignment_id.find(a => a.clientName === slug)?.linear_slug`, falling back to the caller's own `profile.linear_slug` (covers the case where the viewer *is* the customer).

---

## Role-based panels

| Panel | Customer / Stakeholder | Developer / Admin |
|---|---|---|
| "Wiki — coming soon" banner + **Request Report or Documentation** button | ✅ | — |
| Their own requests (`DocumentRequestsList`, read-only) | ✅ | — |
| Requests they can fulfill (`DeveloperDocumentRequests` → `DocumentRequestsList` with `canManage`) | — | ✅ |
| **Project Documents** list | ✅ (full width) | ✅ (2/3 width) |
| **Upload Document** panel | — | ✅ (1/3 width) |

Customers/stakeholders no longer upload documents directly — they **request** one (see below) and a developer/admin fulfills it. This is a real behavior change from the old direct-upload-for-everyone model; the "Wiki — coming soon" banner explains the reasoning in-page ("request a report or technical document below, or browse what's already been uploaded").

---

## Document Requests

**Source:** `components/documents/use-document-requests.ts` (shared `useDocumentRequests` hook/type), `request-document-dialog.tsx`, `document-requests-list.tsx`, `developer-document-requests.tsx`, `fulfill-document-request-modal.tsx`. Backend: `supabase/functions/document-requests/*`, table `portal.document_requests`.

### Fields

| Field | Notes |
|---|---|
| `customer_slug` | The clientName-based slug (matches `profile.assignment_id[].clientName`, **not** `linear_slug`) |
| `requested_by` / `completed_by` / `claimed_by` | Emails |
| `title`, `description` | What's being asked for |
| `project_id`, `project_name` | Optional Linear project link, picked from the same project dropdown as Feature Requests |
| `related_request_id` | Optional link to an earlier request (e.g. "another version of the report I asked for last month") |
| `status` | `"pending"` \| `"done"` |
| `claimed_by` / `claimed_at` | Set when a developer starts fulfilling it (see Claiming below) |
| `completed_at` | Set when marked done |

### 1. Requesting (customer/stakeholder)

1. Click **"Request Report or Documentation"** → `RequestDocumentDialog`.
2. Fill in title (required), an optional project (from `fetchProjects(customerSlug)`, the same Linear-projects lookup Feature Request uses), an optional link to a past request of their own, and optional free-text details.
3. `POST /document-requests` with `{ customerSlug, requestedBy, title, description?, projectId?, projectName?, relatedRequestId? }`.
4. Appears immediately in their own `DocumentRequestsList` under **"Document Requests"** (pending).

### 2. Viewing requests — `DocumentRequestsList`

Two panels, each paginated 3-at-a-time with a "Show More" button:
- **"Document Requests"** — pending requests.
- **"Documents Received"** — done requests.

Clicking a row opens a read-only detail modal (title, status, project, related request if any, requester + date, and completion info once done). Requests are fetched via `useDocumentRequests(customerSlug)` — Supabase queried directly from the client (`portal.document_requests`, no edge function for reads), optionally filtered by `customer_slug`.

**Scoping differs from the documents list above:**
- Customer/stakeholder: their own customer's requests only (`customerSlug` = the resolved `slug`).
- Admin (`DeveloperDocumentRequests`): whichever customer they're currently previewing (`customerSlug` passed through), with `canManage`.
- Developer (`DeveloperDocumentRequests`): **all customers they're assigned to**, not just the one project the Documents list itself is scoped to — computed client-side as `assignedSlugs` from `profile.assignment_id[].clientName`, then filtered against every request (`useDocumentRequests()` called with no `customerSlug`, i.e. fetches everything, then narrowed locally). `canManage` is set here too.

### 3. Claiming and fulfilling (developer/admin, `canManage`)

1. A pending, unclaimed request shows an **"Upload & Share"** button.
2. First click: `PATCH /document-requests { action: "claim", id, claimedBy }` — optimistic lock (`UPDATE ... WHERE status = 'pending' AND claimed_by IS NULL`). Returns `409` if someone else claimed it first (`"Request was already claimed by someone else"`), in which case the row shows a **"Claimed by {email}"** badge and the button disappears for everyone else.
3. Once claimed (by the current user), the button re-opens `FulfillDocumentRequestModal` directly on subsequent clicks (no re-claim needed).
4. In the modal: drag-and-drop or browse for **one file**, then **"Upload & Share"** does three calls in sequence:
   - `POST /storage` (multipart) — uploads the file, `project_slug` = the request's `customer_slug`.
   - `POST /storage/share` — shares the newly uploaded document with `request.requested_by`'s email (grants them `read` permission — see Permission model below).
   - `PATCH /document-requests` (no `action`, i.e. "complete") — marks the request `done`, `completed_by` = current user's email.
5. On success, both the `document-requests` and `documents` queries are invalidated, so the requester sees the new document in their Project Documents list and the request move to "Documents Received".

**Completing a claimed request:** `markDocumentRequestDone` (the PATCH's default branch) rejects with `409` if the request is claimed by someone other than the caller — unless the caller is an `admin`, who can complete any request regardless of who claimed it.

---

## Panel — Project Documents (`DocumentsList`)

**Source:** `components/documents/documents-list.tsx`

### Data loading

Takes `projectSlug` and (admin-only) `customers` as props — it no longer resolves these itself. Fetches `GET /storage?user_id={documentsOwnerId}&project_slug={projectSlug}`.

`documentsOwnerId` comes from `usePinnedPanelsOwnerId()` — **whose** `document_permissions` rows decide the list: the customer currently being previewed (admin/developer browsing a dashboard) when one is set, otherwise the logged-in user's own id. This matters because an admin/developer previewing a customer needs to see *that customer's* documents, not their own near-empty permission set.

The query key also includes an `id` search-param value (`initiativeId`) read via `useSearchParams()` — it's included for cache-key purposes but isn't actually passed to `fetchDocuments`, so it doesn't currently filter anything. Vestigial; flagged as a known gap below.

Each document in the response has the same fields as before:

| Field | Purpose |
|---|---|
| `id` | Unique document identifier |
| `file_name` | Display name and used to derive the file format/icon |
| `category` | One of: Reports, Technical, Design |
| `created_at` | Shown as a formatted date |
| `size` | File size string shown in the row |
| `permission` | `"owner"`, `"write"`, or `"read"` — controls which actions are available |
| `project_slug` | Groups the document under a project folder (null → "Other") |

### Search

A text search box in the card header filters documents by name in real time. No API call is made — filtering is done client-side on the already-loaded list.

### Category filter

Four pill buttons: **All**, **Reports**, **Technical**, **Design**. Selecting one hides documents that don't match. Combined with search — both filters apply at the same time.

### Project grouping

Documents are grouped by their `project_slug`. If documents belong to more than one project, each group renders as a collapsible folder with a header showing the project name and file count. Clicking the header toggles the group open or closed. If all documents belong to a single project, the folder header is hidden and documents are shown flat.

**Slug → display name** (`slugToInitiativeName`): the folder header shows a human-readable name, not the raw `linear_slug`, resolved from whichever of these has it — the caller's own `assignment_id[].linear_slug → clientName` map, their own `profile.linear_slug → profile.clientName`, or (for admins, since they have neither) the `customers` list passed down from the page. Falls back to the raw slug if none match.

### Known gaps

- The **Filter** icon button next to Search renders but has no `onClick` — decorative only, not wired to anything yet.
- The `initiativeId` (`?id=`) query-key inclusion described above doesn't filter results.

### Document row actions

Unchanged from before — each document row shows its file-type icon, name, category badge, date, and size, with action buttons on hover:

| Action | Icon | Who can use it | What it does |
|---|---|---|---|
| **Open** | ExternalLink | Everyone | Calls `GET /storage/download?document_id=...&user_id=...&inline=true` to get a signed URL, then opens it in a new tab (inline view) |
| **Download** | Download | Everyone | Calls `GET /storage/download?document_id=...&user_id=...` (no `inline` param) to get a signed download URL, then opens it |
| **Share** | Share2 | `write` or `owner` | Opens the Share Document modal |
| **Category** | Settings | `write` or `owner` | Opens a popover with the three category options — clicking one calls `PUT /storage` to update the document's category |
| **Delete** | Trash2 | `owner` only | Calls `DELETE /storage` with `{ document_id, user_id }`. On success, the documents list refreshes automatically |

Both Open and Download fetch a fresh **signed URL** from the backend each time they are clicked — the URL is not stored or cached in the UI.

---

## Share Document Modal (`ShareDocumentModal`)

**Source:** `components/documents/ShareDocumentModal.tsx`

Opened by clicking the Share icon on a document row. Only available for documents with `permission` equal to `"write"` or `"owner"`.

The user types one or more email addresses, separated by commas. Clicking **Share** calls `POST /storage/share` with:

```json
{
  "document_id": 123,
  "emails": ["alice@example.com", "bob@example.com"],
  "user_id": "..."
}
```

On success the modal closes and the email input resets. The backend handles sending the share notification and granting `read` access to the recipients — this is also how a fulfilled document request delivers its file (see "Claiming and fulfilling" above, step 4).

**Backend permission check** (`supabase/functions/storage/shareDocument.ts`): the request is rejected with `403 { error: "Unauthorized" }` unless the caller's `document_permissions` row for that document has `permission` equal to `"write"` or `"owner"`. This must match the frontend's gating condition above — if they ever diverge (e.g. backend only allowed `"write"` while the frontend showed Share for `"owner"` too), document owners would get an `"Unauthorized"` error when trying to share.

---

## Panel — Upload Document (`UploadDocument`)

**Source:** `components/documents/upload-document.tsx`. Only rendered for `developer`/`admin` (`canUpload`) — customers/stakeholders go through Document Requests instead.

### How to upload

Two ways to select files:

1. **Drag and drop** — drag files onto the dashed drop zone. The border turns accent-colored while dragging.
2. **Click to browse** — clicking the drop zone opens the system file picker. Multiple files can be selected at once.

Accepted types: PDF, DOCX, XLSX, PNG, JPG (and any other file type — the `accept` attribute is set to `*/*`). Maximum size: 50MB.

### What happens after selecting files

Each file is uploaded immediately and independently — multiple files upload in parallel. For each file, a row appears in the "Uploaded Files" list below the drop zone showing the file name, size, and a status indicator:

| Status | Indicator |
|---|---|
| Uploading | Spinning accent ring |
| Complete | Green checkmark |
| Error | Red X |

Files can be dismissed from the list at any time using the X button next to each row, regardless of upload status.

### Upload API call

Each file is sent via `POST /storage` as `multipart/form-data` with:

| Field | Value |
|---|---|
| `file` | The raw file |
| `bucket` | `"documents_bucket"` |
| `path` | `"uploads/{timestamp}-{filename}"` |
| `user_id` | Supabase auth user ID |
| `email` | User's email |
| `project_slug` | The page-resolved `projectSlug` prop (see "Resolving which customer/project" above) — **not** the raw route slug directly |

The `project_slug` is used to group the uploaded document under the correct project folder in the documents list.

---

## Permission model

The `permission` field on each document determines what a user can do with it:

| Permission | Open | Download | Share | Change Category | Delete |
|---|---|---|---|---|---|
| `read` | ✅ | ✅ | ✗ | ✗ | ✗ |
| `write` | ✅ | ✅ | ✅ | ✅ | ✗ |
| `owner` | ✅ | ✅ | ✅ | ✅ | ✅ |

Documents uploaded by a user have `owner` permission for that user. Documents shared with a user (directly via Share, or via a fulfilled document request) have `read` permission.

---

## Full data flow

```
User lands on /{slug}/documents or /dev/documents
          │
          ├── Resolve `slug` (previewed customer → URL param → profile → assignment fallbacks)
          ├── Resolve `projectSlug` (admin: customers lookup; else: assignment/profile linear_slug)
          │     → admin waits (projectSlugPending) until this resolves
          │
          ├── if canRequest (customer/stakeholder):
          │     Wiki banner + RequestDocumentDialog + DocumentRequestsList (own requests)
          ├── if developer/admin:
          │     DeveloperDocumentRequests → DocumentRequestsList (canManage, scoped to assignments or previewed customer)
          │
          ├── GET /storage?user_id={documentsOwnerId}&project_slug={projectSlug}
          │     → all accessible documents loaded, grouped by project_slug
          │     → filtered by search + category (client-side)
          │
          ├── User opens/downloads a document
          │     → GET /storage/download?document_id=...(&inline=true) → signed URL → new tab
          │
          ├── User shares a document → POST /storage/share { document_id, emails[], user_id }
          ├── User changes category → PUT /storage { document_id, category, user_id } → list refreshes
          ├── User deletes a document → DELETE /storage { document_id, user_id } → list refreshes
          │
          ├── if canUpload (developer/admin): user uploads a file
          │     → POST /storage (multipart) → status tracked per file
          │
          └── Document Requests (independent of the list above):
                ├── POST /document-requests → new pending request
                ├── PATCH /document-requests { action: "claim" } → optimistic lock, 409 if already claimed
                └── Fulfill: POST /storage (upload) → POST /storage/share (deliver) → PATCH /document-requests (mark done)
```

---

## File Map

| File | Responsibility |
|---|---|
| `app/[slug]/(portal)/documents/page.tsx` | Page shell — slug/projectSlug resolution, role-based panel composition |
| `app/dev/documents/page.tsx` | Developer's own entry point (`/dev/documents`) — re-exports the same page |
| `components/documents/documents-list.tsx` | Document list with search, category filter, project grouping |
| `components/documents/document-list-panel.tsx` | Individual document rows with all actions (open, download, share, category, delete) |
| `components/documents/ShareDocumentModal.tsx` | Share modal and `useShareDocument` mutation |
| `components/documents/upload-document.tsx` | Upload panel with drag & drop and file picker (developer/admin only) |
| `components/documents/update-document-entry.ts` | `useUpdateDocument` (category change) and `useDeleteDocument` mutations |
| `components/documents/use-document-requests.ts` | Shared `useDocumentRequests` hook + `DocumentRequest` type |
| `components/documents/request-document-dialog.tsx` | Customer/stakeholder "Request Report or Documentation" dialog |
| `components/documents/document-requests-list.tsx` | Pending/done request panels, detail modal, claim button |
| `components/documents/developer-document-requests.tsx` | Role gate + scoping wrapper around `DocumentRequestsList` for developer/admin |
| `components/documents/fulfill-document-request-modal.tsx` | Upload-and-share-in-one-step modal used to fulfill a claimed request |
| `supabase/functions/document-requests/index.ts` | Router — `POST` create, `PATCH` claim/complete |
| `supabase/functions/document-requests/createDocumentRequest.ts` | Inserts a new pending request |
| `supabase/functions/document-requests/claimDocumentRequest.ts` | Optimistic claim (`WHERE status='pending' AND claimed_by IS NULL`) |
| `supabase/functions/document-requests/markDocumentRequestDone.ts` | Marks done; blocks non-claimer/non-admin completion |
