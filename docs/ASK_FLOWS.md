# Ask about this project (global query) — Flows & How It Works

> SPA-582. A plain-text question about one client's project, answered in plain text from that project's stored **documents, test cases and issues**, with the sources it came from.
> Panel: `components/dashboard/ask-project.tsx` → `AskProject`. Backend: `supabase/functions/ask/`.

---

## Who can ask, and where

| Role | Where the panel is | Which project |
|---|---|---|
| Customer | Top of `/{slug}/dashboard` | Their own client |
| Stakeholder | Top of `/{slug}/dashboard` | The clients they're assigned to |
| Developer | Bottom of `/{slug}/developer` | The initiative selected on the page (switching it clears the previous answer) |
| Admin | Top of `/{slug}/dashboard` of any client | Any client |

The page only shows the panel; **who may ask is decided by the backend** (`ask/access.ts`, `canAsk`), from the caller's session:

- admins: any client;
- customers: only their own client (`users.customer_id`);
- stakeholders and developers: only clients they have an assignment to, with that role (`assignments.customer_id` is the client's customer *user*).

A caller who may not ask gets **403 "You don't have access to this project"**, the same answer as for a client that doesn't exist, so the endpoint doesn't reveal which clients exist.

---

## What it reads (and what it doesn't)

It searches `portal.embeddings`: every object is split into chunks and each chunk has its own gte-small vector (see `FEATURES_FLOWS.md` → "Vector search (pgvector)").

| Source | Text searched | Extra details given to the AI |
|---|---|---|
| Documents | File name, category and the file's text: `.md`, `.txt`, `.csv`, `.mmd` and `.docx` only, capped at 20,000 characters. PDFs and images are searchable by name and category only | File name, upload date |
| Test cases | Title and steps | Creation date |
| Issues | Title and description | Identifier (SPA-123), status, due date, creation date (from `portal.issue_vectors`, kept by the Linear sync) |

**Not read:** chats, ticket comments, Clarifications (decisions), demos, designs, and QA/UAT results.

**The ticket list (cycles, statuses, counts):** matching text can't answer questions about the tickets as a whole ("what's the status of the tickets in the current cycle?", "what's in UAT?", "how many open bugs?"). So every question also fetches the client's tickets **live** from its ticket system (`tickets.listIssues()`, Linear or Jira, already scoped to the client) and gives the AI one line per ticket: code, title, status, cycle (and whether it's the current one), priority, assignee, due date, type. Current-cycle tickets come first, then open work, then closed tickets, at most 150 lines. Linear returns 100 tickets per request; when a client has more, the open ones are fetched on their own so current work is never what's cut. If the ticket system fails, the answer goes on without the list. Statuses here are always current, unlike the ones stored with the embeddings (kept by the Linear sync).

**Ticket codes:** a code in the question ("is there a ticket SPA-582?") is looked up exactly, not by meaning: codes aren't in the embedded text, and two codes embed almost the same. Matching tickets of this client come first among the sources. Any `LETTERS-123` shape counts, in any case.

**Statuses:** the AI sees the status of each issue the search returns, at most 10. "What's the status of the SSO login?" works; "how many open bugs are there?" or "list everything in UAT" doesn't, because it never sees all the tickets.

---

## Flow

```
User types a question and presses Ask (Enter also sends; Shift+Enter = new line)
          │
          ├── POST /functions/v1/ask { slug, question }   (lib/ask-api.ts, user's session token)
          │
          ├── 401 if not signed in · 400 if no slug, empty question or > 500 chars
          ├── findClient(slug): clientName or linear_slug, ignoring case
          ├── canAsk(caller, client) → 403 if not allowed
          │
          ├── searchProject(client.linearSlug, question)        (lib/vector.ts)
          │     → embeds the question with gte-small
          │     → portal.match_embeddings: scoped to the client's project_slug IN SQL,
          │       each object's best chunk, best first, top 10
          │
          ├── issuesByCode: ticket codes in the question (SPA-582) looked up exactly
          │     in this client's issue_vectors.identifier; they go first
          │
          ├── relevantSources: keeps similarity ≥ 0.8 (MIN_SIMILARITY)
          ├── withDetails: adds title / dates / status / kind; drops objects deleted since
          │
          ├── liveTickets: the client's tickets from Linear / Jira, one line each
          │     (status, cycle, priority, assignee, due date)
          │
          ├── no sources and no tickets → { found: false } — "not found", the AI isn't called
          │
          ├── AI configured? (AI_API_KEY) → otherwise 503
          ├── buildAskPrompt (ask/prompt.ts) → requestJson (lib/aiClient.ts)
          │     schema project_answer: { found, answer, sources: [numbers], tickets: [codes] }
          │
          └── { question, found, answer, sources: the cited numbered sources, then the cited tickets }
```

While it waits, the panel shows a thin orange bar sliding left to right under the input (no text; screen readers get "Looking through the project's documents, test cases and issues"). Then the answer appears below the input with the cited sources (an issue's code and status in orange), or the "not found" message.

### The prompt

Each source is numbered so the answer can cite it, and written the way the ticket asks: type, ID, title, dates, status, then its content (the best-matching chunk, at most 2,000 characters):

```
[1] Document 123: How login works. Created 2019-01-01.
<content>

[2] Issue SPA-456: Login with SSO. Created 2020-02-02. Due 2021-03-03. Backlog
<content>
```

Rules given to the AI: answer only from those sources (no outside knowledge, no guessing), set `found: false` when they don't cover it, plain text and short, list the numbers of the sources it relied on, name items the way they appear ("Issue SPA-456"), and **answer in the language of the question**.

The project is never chosen through the prompt: the search is already limited to one client in SQL.

### Sources on screen

| Type | Opens |
|---|---|
| Issue (bug) | `/{slug}/bugs?issueId=…`: the Bugs page with the ticket's modal open |
| Issue (feature or other) | `/{slug}/build?issueId=…` |
| Document | `/{slug}/documents` |
| Test case | Not a link (test cases have no page of their own) |

Both Bugs and Build open a ticket that isn't in their lists by fetching it by id, checked against the client (`issues/by-id?slug=`).

---

## Which AI answers

The answer comes from the portal's shared AI client (`lib/aiClient.ts`, `AI_*` secrets, see `PORTAL_DOCS.md` §12), like Query and suggested features. The ticket asks for a Hugging Face model: that means pointing `AI_BASE_URL` / `AI_MODEL` at Hugging Face's router. The embeddings (gte-small) run inside the edge function and don't use those secrets.

---

## Setting it up on an environment

1. Apply `supabase/migrations/20261110120000_embeddings_table.sql` (needs `20261105120000_pgvector_only.sql` first). It only adds: `portal.embeddings`, `portal.match_embeddings`, `embeddings_complete` on documents and tests, and the issue columns the answer cites.
2. Deploy `ask`, plus the functions that write embeddings: `storage` (documents), `tests`, `issues` and `linear-vector-sync`.
3. Backfill what already exists, or every question answers "not found": `node scripts/backfill-pgvector.mjs [clientName]` with `SUPABASE_URL`, `SERVICE_ROLE_KEY` (the legacy `eyJ…` one) and `ADMIN_USER_ID` set (bash and PowerShell examples in `FEATURES_FLOWS.md` → "Backfilling embeddings"). It loops and retries on its own; safe to re-run. Check with `select source_type, count(*) from portal.embeddings group by source_type;`.
4. `AI_API_KEY` (and the rest of `AI_*`) set for the project, or the function answers 503 when it finds sources.

---

## Example questions

- "How does login work?" / "What does the documentation say about user permissions?"
- "What's left to finish the SSO login?"
- "Is there a bug reported about exporting reports as PDF?"
- "Which tests cover the checkout flow?"
- "When is the email notifications ticket due?"
- "What's the status of the tickets in the current cycle?" / "What's in UAT?" / "What is Facundo working on?"
- Something the project doesn't cover ("What's the capital of France?") should answer "not found".

---

## Known limits

- The ticket list has at most 150 tickets (current cycle and open work first); the answer says so when it's cut. Documents and test cases are still matched by text only (top 10).
- Every question now calls the AI and the ticket system (about a second more), even when no document or test matches.
- The threshold (0.8) is the same first-pass value as similar issues (`FEATURES_FLOWS.md` → "Similarity thresholds"), not calibrated for questions.
- PDFs and images aren't read.
- Each question is independent: there's no conversation history.

---

## File Map

| File | Responsibility |
|---|---|
| `components/dashboard/ask-project.tsx` | `AskProject` panel: input, loading state, answer, cited sources and their links |
| `lib/ask-api.ts` | `askProject(slug, question)`, `AskSource` / `AskAnswer` types, `MAX_QUESTION_LENGTH` |
| `app/[slug]/(portal)/dashboard/page.tsx` | Renders the panel at the top of the Dashboard |
| `app/[slug]/(portal)/developer/page.tsx` | Renders the panel at the bottom of the Developer page, for the selected initiative |
| `supabase/functions/ask/index.ts` | `POST /ask`: auth, access, search, details, AI call, cited sources |
| `supabase/functions/ask/access.ts` | `findClient` (slug → client) and `canAsk` (role and assignment check) |
| `supabase/functions/ask/prompt.ts` | `MIN_SIMILARITY`, `MAX_SOURCES`, `MAX_CONTENT_CHARS`, `buildAskPrompt`, `citedSources` (no imports, unit-tested) |
| `supabase/functions/lib/vector.ts` | `searchProject`: embeds the question and calls `match_embeddings` for documents, tests and issues |
| `supabase/migrations/20261110120000_embeddings_table.sql` | `portal.embeddings`, `portal.match_embeddings`, the issue columns the answer cites |
| `tests/unit/ask.spec.ts` | Prompt, threshold and citation rules |
| `tests/e2e/ask.spec.ts` | The panel end to end (mocked `/ask`) |
