# Ticket Systems (Linear / Jira) — Flows & How It Works

> Reference for the ticket-system wrapper: each customer's tickets can live in Spark & Co's Linear workspace or in the customer's own Jira. The portal sends every ticket request through one wrapper, which routes it to the right system.
> Shared code: `supabase/functions/lib/tickets/`
> Customer setup: Add/Edit Customer in the Admin panel (`app/admin/users/AddClientModal.tsx`, `EditClientModal.tsx`, `components/shared/ticket-system-fields.tsx`)

---

## Status

| Area | Linear | Jira |
|---|---|---|
| Customer setup (dropdown, credentials, Test connection) | ✅ | ✅ |
| Build & Bugs pages, ticket detail (`issues` function) | ✅ through the wrapper | ✅ list, view, create, edit, change status, comments, projects (epics), milestones (versions), labels, sprint picker |
| File attachments | ✅ | ⚠️ listed (links open Jira and need an Atlassian login); uploading/attaching answers 501 |
| Roadmap (`roadmap` function) | ✅ through the wrapper | ✅ epics as rows, versions as milestones, sprints as columns |
| Dashboard panels, metrics (`issueMetrics`, `dora`, `manual-metrics`…), suggested features, chat, demo videos, vector sync, and other Linear callers | Unchanged — still call Linear directly | ❌ Not yet: empty or an error for Jira customers |
| Azure DevOps (ADO) | — | Planned |

Anything not yet moved behind the wrapper keeps working for Linear customers exactly as before.

---

## Choosing a customer's ticket system

**Where:** Admin → Users → **Add Customer** or a customer's **Profile → Edit**. Both use the shared `TicketSystemFields` component.

| Field | Linear | Jira |
|---|---|---|
| Ticket System | `Linear` (default) | `Jira` |
| Project id | **Linear Slug**: the initiative's slug in Spark & Co's workspace | **Jira project key**: the letters before ticket numbers (`ACME` for `ACME-12`); upper-cased as typed |
| Jira URL | — | The site's address, e.g. `https://acme.atlassian.net` (any page URL is cut down to the site) |
| Jira account email | — | The account the portal connects as. Ideally a bot user with access to this project only. **Not** the customer's portal login. |
| API token | — | Created at id.atlassian.com → Security → API tokens → **Create API token**. Atlassian tokens expire (at most a year). |

- **Test connection** (Jira only) checks the email and token (`/rest/api/3/myself`), then that the project exists and the account can see it (`/rest/api/3/project/{key}`). The result reads "Connected as {name} · {project}" or says what failed: wrong token, unknown project, bad URL, etc.
- **Saving always tests the connection first.** Nothing is created or changed with credentials that don't work.
- **Editing:** the token is never sent back to the browser. A blank token keeps the stored one ("Saved — leave blank to keep it"). **Changing the Jira URL requires entering the token again**, so a stored token is never sent to a new address.
- Switching a customer back to Linear deletes its stored token.
- Only admins can change a customer's ticket system (`updateCustomer.ts`, `assertCanUpdate`).

### What a Jira customer needs to give us

1. Their Jira URL.
2. The email of the account the portal will use (a dedicated bot user is best).
3. An API token for that account.
4. The project key.

---

## Where things are stored

No new tables or columns. Everything lives on `portal.customers`, plus Vault:

| Data | Where |
|---|---|
| Which system | `customers.systems.tickets`: `"linear"` or `"jira"`. **Missing means Linear**, so every customer created before this feature is a Linear customer. `systems` has no constraint on this key, on purpose. |
| Jira URL and account email (not secret) | `customers.systems.jira = { base_url, email }` |
| Jira API token | Supabase Vault secret named `ticket_token:{customer_id}`. Read and written only by the edge functions (service role) through `portal.set_ticket_token`, `portal.get_ticket_token` and `portal.delete_ticket_token` (migration `20261101120000_ticket_system_vault_token.sql`). Deleted automatically when the customer row is deleted. |
| Project id in that system | `customers.linear_slug`: the Linear initiative slug, or the Jira project key. The column keeps its name; only the UI label changes. |
| Ids of tickets, projects, milestones, cycles | Existing `text` columns (`decisions.issue_id`, `notifications.issue_id`, `issue_requests.issue_id`, `hours_logged.issue_ids`, …). Jira ids fit as they are (see "Ids" below). |

Linear needs no per-customer credentials: it uses the portal's own `LINEAR_API_KEY`, because Linear customers live in Spark & Co's workspace.

---

## How the wrapper works

```
handler (issues/, roadmap/)
   │  ticketsForSlug(slug) / ticketsForId(id) / roadmapForCustomer(row) / roadmapForId(id)
   ▼
lib/tickets/provider.ts ── reads customers.systems.tickets
   ├── lib/tickets/linear/issues.ts, linear/roadmap.ts   (LINEAR_API_KEY, GraphQL)
   └── lib/tickets/jira/issues.ts,   jira/roadmap.ts     (customer's site, REST v3 + Agile v1, token from Vault)
```

- **Both adapters return the same shapes:** the ones the Linear GraphQL queries always returned, which the pages are built on. The Jira adapter converts Jira data into those shapes, so the frontend doesn't branch.
- **Requests that carry a customer slug** (list tickets, create one, roadmap rows) pick the adapter from the customer row.
- **Requests that only carry an id** (change a ticket's status, list its attachments, open a cycle) pick it from the id itself (see below).
- **Errors:** adapters throw `TicketError(message, status)` (`lib/tickets/errors.ts`). Handlers answer with that status and message, so the portal shows a readable reason, e.g. "Jira refused it: …" or "isn't available for Jira customers yet" (501).

### Ids

`lib/tickets/ids.ts`

- **Linear ids pass through untouched**, so every id stored before the wrapper is still valid.
- **Jira ids say where they came from:** `jira:{customer_id}:{native id}`. Examples:
  - `jira:6f1c…:SPA-12`: a ticket or an epic
  - `jira:6f1c…:sprint:42`: a sprint
  - `jira:6f1c…:version:10001`: a version (ticket form milestone picker)
  - `jira:6f1c…:version:10001:SPA-1`: a version within one epic (roadmap milestone)
  - `jira:6f1c…:noversion:SPA-1`: an epic's tickets with no version (roadmap)

So any request with just an id knows which system and which customer's credentials to use.

---

## Jira mapping

| Portal (Linear concept) | Jira |
|---|---|
| Customer / initiative | One Jira **project** (`customers.linear_slug` = project key) |
| Project | **Epic** (a ticket's parent) |
| Milestone | **Version** (Fix Version). In Jira, versions belong to the whole project, not to an epic. |
| Cycle | **Sprint** (the project's board) |
| Ticket | Story / Task / Bug (epics and sub-tasks are not listed as tickets) |
| Bug vs. feature | **Issue type.** Bug shows as a `bug` label and Story as a `feature` label, because the Bugs page and ticket detail tell them apart by label. Jira's own labels are listed too. |
| Estimate | Story points (`Story point estimate` on team-managed projects, `Story Points` on company-managed; field ids are looked up per site) |
| Priority | Highest → Urgent, High → High, Medium → Medium, Low/Lowest → Low; none → "No priority" |
| Description, comments | Converted between Markdown (portal) and Jira's ADF (`jira/adf.ts`): paragraphs, headings, lists, code, quotes, links, bold/italic/strike/inline code. Anything else falls back to plain text. |

### Statuses

The portal is built on Spark & Co's Linear workflow: Backlog → Planning → **Business Review** → Development → **QA** → **UAT** → Approved/Done. Build columns, the dashboard panels and the ticket detail's approve/advance buttons all depend on those names.

Rule (`jira/status.ts`):

1. **A Jira status with the same name as a portal state is that state.** Case doesn't matter, and common synonyms count: "Code Review" → In Review, "Won't Do" → Canceled, "Testing" → QA, etc.
2. **Anything else goes by its Jira category:** to do → **Backlog**, in progress → **Development**, done → **Done**. This works in any language, e.g. "Por hacer / En curso / Listo".

So a customer whose board has **Business Review**, **QA** and **UAT** columns gets those portal flows; one who doesn't still sees every ticket.

**Changing a status** uses Jira transitions. The adapter picks a transition into a status with that portal state's name; failing that, the first transition into the same category ("Development" → "En curso"). If the workflow has no way there, the portal shows *"This ticket's Jira workflow has no step to …"*.

### Roadmap

`jira/roadmap.ts`, `jira/roadmapMap.ts`

- **Rows** are the project's **epics**. An epic's status category picks its group: to do → *Upcoming*, in progress → *Active*, done → *Completed*. Its due date is the row's target date.
- **Milestones in a row** are the versions its tickets are in, ordered by release date. Tickets with no version go in a **"No version"** milestone, so they still show on the timeline.
  - Status: *done* if the version is released or all its tickets are done; *overdue* if the release date has passed; *in-progress* if any ticket has started; otherwise *unstarted*.
- **Columns** are the board's **sprints**, labelled with the sprint name and ordered by date. **A sprint needs a start and end date to show up.** With no sprints the timeline shows "No cycles found for this team".
- Clicking a sprint, milestone or epic lists its tickets (25 per page), narrowed to that epic.

### Setting up a Jira project so everything shows

1. **Epics** for the work streams, with a due date (and a start date if you like).
2. **Stories/tasks inside epics** (set the parent).
3. **Versions** with release dates, assigned to tickets (Fix Version).
4. **Sprints enabled** (team-managed: Project settings → Features → Sprints), each with start and end dates, one active, with tickets in them.
5. *Optional:* board columns named **Business Review**, **QA**, **UAT** for those portal flows.

---

## Not available yet for Jira

- **Uploading and attaching files.** `uploadFile` and `createAttachment` answer 501. When creating a ticket for a Jira customer, don't attach files: the ticket is created but the attachment fails. Existing attachments are listed, but their links point at Jira and need an Atlassian login (the image proxy only handles Linear today).
- **Admin initiative picker** (`/issues/projects?initiativeId=`): Linear only.
- Every function not yet moved behind the wrapper (see Status).

---

## Adding another system (e.g. ADO)

1. Add the value to `TICKET_SYSTEMS` in `lib/tickets/ticketSystem.ts` and `lib/ticket-systems.ts` (frontend), and its fields to `TicketSystemFields`.
2. Write `lib/tickets/{system}/issues.ts` and `roadmap.ts` returning the same shapes as the Linear adapters (`TicketsAdapter`, `RoadmapAdapter`).
3. Route to it in `lib/tickets/provider.ts`, and give its ids a prefix in `lib/tickets/ids.ts`.
4. Store its credentials the same way (`systems.{system}` + `set_ticket_token`).

---

## Testing

- **Unit tests** (no network): `tests/unit/tickets.spec.ts` (settings, validation, ids) and `tests/unit/jira-adapter.spec.ts` (ADF ↔ Markdown, status rule, issue and roadmap mapping). Run with `npx playwright test --project=unit`.
- **Against a real Jira:** create a test customer with Ticket System = Jira (Spark & Co's test project is **SPA** on `sparknco.atlassian.net`) and use the Build, Bugs and Roadmap pages.
- **Validating edge functions locally:** `npx -y deno@2.1.4 check --node-modules-dir=none supabase/functions/<fn>/index.ts` (the same Deno version as Supabase's runtime).

---

## File Map

| File | Role |
|---|---|
| `supabase/functions/lib/tickets/provider.ts` | Picks the adapter: `ticketsForSlug/ForId/ForCustomer`, `roadmapForCustomer/ForId` |
| `supabase/functions/lib/tickets/ids.ts` | `jiraId`, `parseTicketId` |
| `supabase/functions/lib/tickets/errors.ts` | `TicketError`, `TicketCustomer` |
| `supabase/functions/lib/tickets/ticketSystem.ts` | `ticketSystemOf`, Jira input validation, error messages (no Deno imports) |
| `supabase/functions/lib/tickets/jiraConnection.ts` | Test connection, Vault token helpers |
| `supabase/functions/lib/tickets/linear/client.ts` | `linearRequest` and shared Linear queries |
| `supabase/functions/lib/tickets/linear/issues.ts` | Linear tickets adapter |
| `supabase/functions/lib/tickets/linear/roadmap.ts`, `roadmapQueries.ts` | Linear roadmap adapter |
| `supabase/functions/lib/tickets/jira/client.ts` | Jira session: requests, token, project, custom fields, board, search |
| `supabase/functions/lib/tickets/jira/issues.ts` | Jira tickets adapter |
| `supabase/functions/lib/tickets/jira/roadmap.ts`, `roadmapMap.ts` | Jira roadmap adapter and mapping |
| `supabase/functions/lib/tickets/jira/map.ts` | Jira issue → portal ticket |
| `supabase/functions/lib/tickets/jira/status.ts` | Status rule and transitions |
| `supabase/functions/lib/tickets/jira/adf.ts` | ADF ↔ Markdown |
| `supabase/functions/users/ticketSystemSettings.ts` | Validate, test and save a customer's ticket system; Test connection endpoint |
| `supabase/migrations/20261101120000_ticket_system_vault_token.sql` | Vault token functions + delete trigger |
| `lib/ticket-systems.ts`, `lib/ticket-systems-api.ts` | Frontend: options, form state, Test connection call |
| `components/shared/ticket-system-fields.tsx` | Ticket system fields in Add/Edit Customer |
| `supabase/functions/issues/linearClient.ts`, `issues/syncLinearProjects.ts` | Re-export shims for functions not moved behind the wrapper yet |
