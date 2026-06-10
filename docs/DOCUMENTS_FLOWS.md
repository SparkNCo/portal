# Documents — Flows & How It Works

> Reference for the Documents page and all its panels.  
> Main page: `app/[slug]/dashboard/(portal)/documents/page.tsx` → `DocumentsPage`

---

## Who sees this page

Documents is accessible to `customer`, `stakeholder`, and `developer`. It appears in the sidebar nav for all three roles. The page is the same for everyone — what differs is which documents each user can see and what actions they can take on each one, controlled by the `permission` field on each document record.

---

## Page Layout

The page is a 3-column grid (stacks on mobile):

```
┌─────────────────────────┬──────────────┐
│  Project Documents      │  Upload      │
│  (2/3 width)            │  Document    │
│                         │  (1/3 width) │
└─────────────────────────┴──────────────┘
```

---

## Panel 1 — Project Documents (`DocumentsList`)

**Source:** `components/documents/documents-list.tsx`

### Data loading

On mount, calls `GET /storage?user_id={profile.id}` to fetch all documents the current user has access to.

Each document in the response has the following fields used by the UI:

| Field | Purpose |
|---|---|
| `id` | Unique document identifier |
| `file_name` | Display name and used to derive the file format/icon |
| `category` | One of: Reports, Technical, Design |
| `created_at` | Shown as a formatted date |
| `size` | File size string shown in the row |
| `permission` | `"write"` or `"read"` — controls which actions are available |
| `project_slug` | Groups the document under a project folder (null → "Other") |

### Search

A text search box in the card header filters documents by name in real time. No API call is made — filtering is done client-side on the already-loaded list.

### Category filter

Four pill buttons: **All**, **Reports**, **Technical**, **Design**. Selecting one hides documents that don't match. Combined with search — both filters apply at the same time.

### Project grouping

Documents are grouped by their `project_slug`. If documents belong to more than one project, each group renders as a collapsible folder with a header showing the project name and file count. Clicking the header toggles the group open or closed.

If all documents belong to a single project, the folder header is hidden and documents are shown flat.

### Document row actions

Each document row shows its file-type icon, name, category badge, date, and size. Action buttons appear on hover:

| Action | Icon | Who can use it | What it does |
|---|---|---|---|
| **Open** | ExternalLink | Everyone | Calls `GET /storage/download?document_id=...&user_id=...&inline=true` to get a signed URL, then opens it in a new tab (inline view) |
| **Download** | Download | Everyone | Calls `GET /storage/download?document_id=...&user_id=...` (no `inline` param) to get a signed download URL, then opens it |
| **Share** | Share2 | `write` only | Opens the Share Document modal |
| **Category** | Settings | `write` only | Opens a popover with the three category options — clicking one calls `PUT /storage` to update the document's category |
| **Delete** | Trash2 | `write` only | Calls `DELETE /storage` with `{ document_id, user_id }`. On success, the documents list refreshes automatically |

Both Open and Download fetch a fresh **signed URL** from the backend each time they are clicked — the URL is not stored or cached in the UI.

---

## Share Document Modal (`ShareDocumentModal`)

**Source:** `components/documents/ShareDocumentModal.tsx`

Opened by clicking the Share icon on a document row. Only available for documents with `permission === "write"`.

The user types one or more email addresses, separated by commas. Clicking **Share** calls `POST /storage/share` with:

```json
{
  "document_id": 123,
  "emails": ["alice@example.com", "bob@example.com"],
  "user_id": "..."
}
```

On success the modal closes and the email input resets. The backend handles sending the share notification and granting access to the recipients.

---

## Panel 2 — Upload Document (`UploadDocument`)

**Source:** `components/documents/upload-document.tsx`

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
| `project_slug` | The `slug` URL param (the customer's slug) |

The `project_slug` is used to group the uploaded document under the correct project folder in the documents list.

---

## Permission model

The `permission` field on each document determines what a user can do with it:

| Permission | Open | Download | Share | Change Category | Delete |
|---|---|---|---|---|---|
| `read` | ✅ | ✅ | ✗ | ✗ | ✗ |
| `write` | ✅ | ✅ | ✅ | ✅ | ✅ |

Documents uploaded by a user have `write` permission for that user. Documents shared with a user have `read` permission.

---

## Full data flow

```
User lands on /{slug}/dashboard/documents
          │
          ├── GET /storage?user_id={id}
          │     → all accessible documents loaded
          │     → grouped by project_slug
          │     → filtered by search + category (client-side)
          │
          ├── User opens a document
          │     → GET /storage/download?document_id=...&inline=true
          │     → signed URL → window.open in new tab
          │
          ├── User downloads a document
          │     → GET /storage/download?document_id=...
          │     → signed URL → window.open in new tab
          │
          ├── User shares a document
          │     → POST /storage/share { document_id, emails[], user_id }
          │
          ├── User changes document category
          │     → PUT /storage { document_id, category, user_id }
          │     → documents query invalidated → list refreshes
          │
          ├── User deletes a document
          │     → DELETE /storage { document_id, user_id }
          │     → documents query invalidated → list refreshes
          │
          └── User uploads a file
                → POST /storage (multipart)
                → status tracked per file (uploading → complete/error)
```

---

## File Map

| File | Responsibility |
|---|---|
| `app/[slug]/dashboard/(portal)/documents/page.tsx` | Page shell — layout and component composition |
| `components/documents/documents-list.tsx` | Document list with search, category filter, project grouping |
| `components/documents/document-list-panel.tsx` | Individual document rows with all actions (open, download, share, category, delete) |
| `components/documents/ShareDocumentModal.tsx` | Share modal and `useShareDocument` mutation |
| `components/documents/upload-document.tsx` | Upload panel with drag & drop and file picker |
| `components/documents/update-document-entry.ts` | `useUpdateDocument` (category change) and `useDeleteDocument` mutations |
