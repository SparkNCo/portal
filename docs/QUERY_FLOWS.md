# Query — Flows & How It Works

> Reference for the Query page: connecting a client's own databases, reading their structure, and asking them questions in plain text (SPA-487 to SPA-492).
> Page: `app/[slug]/(portal)/query/page.tsx` → `QueryPage`
> Edge functions: `supabase/functions/data-sources/` (connections and structure) and `supabase/functions/query/` (questions)

---

## Who sees this page

**Admins only, for now.** "Query" is in the menu an admin sees after picking an initiative (between Chat and Settings). It's added in `adminCustomerNavItems` in `components/sidebar.tsx`. Customers, stakeholders and developers have their own menus and don't get it.

Opening `/{slug}/query` as anyone else redirects to that user's home page with "You've been redirected to your home page" (`query: ["admin"]` in `PAGE_ROLES`, `lib/route-access.ts`).

Unlike the rest of the `/{slug}` pages, the backend checks too: both edge functions resolve the caller from the **session token** (`resolveCaller`) and answer `401` without a session and `403` for anyone who isn't an admin. The frontend sends `session.access_token` as the bearer token (`lib/data-sources-api.ts`, `lib/query-api.ts`). The body is never trusted for identity.

Opening Query to customers later means changing `PAGE_ROLES`, the menus and the role check in both functions.

---

## What it is, end to end

A client has its own database (shop orders, CRM, analytics…), in **PostgreSQL or SQL Server** (including Azure SQL Database). See "Database engines" below. An admin connects it to the portal. The portal reads the database's **structure** (tables, columns, types, keys, enum values) and stores it. Then anyone on the page can ask a question in plain text: the AI turns it into SQL using that structure, the portal runs the SQL **read-only** against the client's database and shows the rows.

1. **Connect:** an admin enters host, port, database, user, password and SSL. The connection is tested, then saved.
2. **Store:** the connection details go to `portal.data_sources`, and the password to Supabase Vault.
3. **Read the structure:** `information_schema` and `pg_catalog` are queried, and the result is saved as JSON in Storage.
4. **Ask:** the question plus the structure go to the AI, which returns SQL.
5. **Answer:** the SQL runs read-only in the client's database, and the rows come back to the page.

**The client's rows are never copied into Supabase.** Every question is answered live, and its result is only shown.

| What | Where | Client data? |
|---|---|---|
| Host, port, database, user, SSL | `portal.data_sources` (Supabase) | No, only how to connect |
| Password | Supabase Vault, encrypted, one secret per connection | No |
| Structure (tables, columns, types, keys, enums) | Bucket `data_source_schemas`, `{customer_id}/{data_source_id}.json` | Structure only, no rows |
| Rows | Stay in the client's database | Yes |
| A question's result | Passes through the `query` function to the browser; not stored | Yes, only displayed |

The AI receives the question and the structure, **never rows**.

---

## Page layout

When the client has no connections: an empty state ("No databases connected yet") and the **Connect database** button in the header.

With connections:

1. **Ask a question** panel at the top. It only lists connections whose structure has been read.
2. **Connections**: one card per connection.

Loading shows a skeleton; a failed load shows the error.

---

## Connecting a database — `DataSourceForm`

`components/query/data-source-form.tsx`, opened by **Connect database** or by **Edit** on a card.

**Fields:** database type (PostgreSQL or SQL Server; changing it moves the port to that engine's default unless one was typed in), name (unique per client, e.g. "Production"), host, port (default `5432` / `1433`), database, username, password, and "Connect with SSL" (on by default). The dialog asks for a read-only user.

**Test connection** → `POST /data-sources/test` connects, runs `select 1` with a 5 s connect timeout, and closes. The result shows under the form, in green ("Connected successfully.") or red. It clears when any field changes.

Errors are described in words an admin can act on (`data-sources/connectionErrors.ts`):

| Cause | Message |
|---|---|
| `28P01` / password failed | Wrong username or password. |
| `3D000` | The database "x" doesn't exist on this server. |
| `28000` | This user isn't allowed to connect to that database. |
| DNS lookup failed | Couldn't find the host "x". Check the address. |
| Connection refused | host:port refused the connection… |
| Timeout | host:port didn't answer within 5 seconds… firewall… |
| SSL / TLS | The SSL connection failed (…). Try with SSL on/off. |

**Save** → `POST /data-sources` (`createDataSource.ts`):

1. Finds the client by the URL slug (`customers.clientName`, case-insensitive).
2. Tests the connection again. If it fails, nothing is saved (`400`).
3. Inserts the row in `portal.data_sources`. A duplicate name for the client gives `409` "This client already has a connection named …".
4. Stores the password with `portal.set_data_source_password`. If that fails, the row is deleted again, so a connection never exists without its password.
5. Reads the structure (below). If that part fails, the connection **stays saved** with the reason in `schema_error`, and the dialog shows a warning toast.

Responses never include the password or its Vault secret id (`DATA_SOURCE_COLUMNS`, `data-sources/columns.ts`).

### Editing — `PATCH /data-sources/:id`

The form opens with the saved details. **An empty password keeps the stored one.** "Test connection" on a saved connection sends its `id`, so the stored password is used. The new details are tested before anything is saved, and the structure is read again afterwards, since it may point at another database now.

### Deleting — `DELETE /data-sources/:id`

A confirmation dialog first: "The portal forgets this connection, its password and its structure. The client's database itself isn't touched." Then the structure file is removed from Storage, and the row is deleted.

The Vault secret is removed by the `data_sources_delete_vault_secret` trigger (`AFTER DELETE`). That also covers a client being deleted, whose connections go in cascade.

---

## Database engines — `engines.ts`

> **SQL Server is written but not available yet.** Its driver (`npm:mssql` / tedious) needs Deno 2.7 or newer: on older runtimes the TLS handshake fails with `ECONNRESET`, whatever the encryption mode. Supabase's edge runtime is `supabase-edge-runtime-1.77.0 (compatible with Deno v2.1.4)` as of October 2026 (it's logged on every failed SQL Server connect). Checked against Azure SQL with a throwaway login: Node, and Deno 2.7+, get through; Deno 2.1–2.5 don't.
>
> Meanwhile "SQL Server" is listed in the form as "coming soon" and can't be picked (`available: false` in `DATABASE_ENGINES`, `lib/data-sources-api.ts`), and the backend refuses it with "SQL Server connections aren't available yet…" (`sqlServerUnavailable`, `engines.ts`). The backend lifts that by itself once the runtime reports Deno ≥ 2.7; then set `available: true` in the form.
>
> If SQL Server is needed sooner, the way around it is to run the SQL Server adapter on Node (e.g. an internal Next.js route that the edge functions call with a shared secret), where the driver works.

Each connection has a `type`, and everything engine-specific goes through `engineFor(type)` (`supabase/functions/data-sources/engines.ts`): testing a connection, reading the structure, running a generated query and explaining failures. The rest (the table, Vault, Storage, the page, the AI call) is shared.

| | PostgreSQL (`postgres`) | SQL Server / Azure SQL (`sqlserver`) |
|---|---|---|
| Driver | `npm:postgres` (`postgresClient.ts`) | `npm:mssql` (`sqlserver.ts`) |
| Default port | 5432 | 1433 |
| Connect timeout | 5 s | 30 s: Azure SQL serverless databases (the free offer among them) pause when idle and take a while to wake up |
| Encryption (SSL on) | `ssl: "require"` | TDS 8.0 **`strict`** first (a plain TLS connection, which works in the edge runtime), then the classic mode for servers older than SQL Server 2022. The classic mode alone fails in Deno with `ECONNRESET` |
| Structure | `pg_catalog`: tables, views, columns, keys, **enum types** (`introspect.ts`) | `INFORMATION_SCHEMA` + `sys.*`: tables, views, columns, keys, `MS_Description` comments. No enums: a `CHECK` that limits a column to fixed values (`status IN ('paid', …)`) becomes that column's `values` (`sqlserverStructure.ts`) |
| Dialect asked of the AI | PostgreSQL: `LIMIT`, `ILIKE`, `public.table` | T-SQL: `TOP (n)`, no `LIMIT`, `GETDATE()`/`DATEADD`, `dbo.table`, `[brackets]` |
| Read-only | `READ ONLY` transaction | No read-only transactions in SQL Server: the query runs in a transaction that is **always rolled back** |
| Timeout | `statement_timeout` 15 s | Request timeout 15 s |
| Row cap | Wrapped in `select * from (…) limit 501` | `SET ROWCOUNT 501` (T-SQL can't wrap a CTE in a subquery) |
| Errors | Postgres codes (`28P01`, `3D000`, `57014`, `25006`, `42501`) | SQL Server numbers (`18456` login, `4060` database, `40615` / "Client with IP address … is not allowed" **firewall**, `229` permission, `208` missing table, `ETIMEOUT`) |

**Azure SQL firewall:** Azure refuses every address by default, and edge functions have no fixed IP. The server's Networking settings need public access and a rule that lets the portal in; for a test database, `0.0.0.0`–`255.255.255.255`. Without it the form shows "The server's firewall refused the connection from <ip>".

Adding another engine means another entry in `ENGINES`, its value in the `data_sources_type_check` constraint, `DEFAULT_PORTS` (`connectionInput.ts`) and `DATABASE_ENGINES` (`lib/data-sources-api.ts`), and its dialect in `DIALECTS` (`query/describeStructure.ts`).

---

## Reading the structure — `introspect.ts`, `refreshStructure.ts`

Runs after every save and edit, and from the **Refresh structure** (🔄) button on a card (`POST /data-sources/:id/refresh-structure`).

For Postgres, three catalog queries (SQL Server: see "Database engines"), over **only what the connecting user may read** (`has_table_privilege(..., 'SELECT')`), with system schemas (`pg_catalog`, `information_schema`, `pg_toast*`, `pg_temp*`) and partitions left out:

- **Tables and views** (`r`, `p`, `v`, `m`, `f`) with their columns: exact type (`format_type`, e.g. `numeric(10,2)` or the enum's name), whether they're nullable, and table and column comments.
- **Primary and foreign keys** (`pg_constraint`), with column order kept.
- **Enum types** and their values, in order. Only those in schemas that have readable tables are kept.

No rows are read.

The result (`DatabaseStructure`) is uploaded to `data_source_schemas/{customer_id}/{data_source_id}.json` (`upsert`), and the row gets `schema_path` and `schema_refreshed_at`, with `schema_error` cleared. On failure only `schema_error` is set, and the previous file, if there was one, is kept.

```json
{
  "dataSourceId": "…",
  "database": "shop",
  "refreshedAt": "2026-10-16T12:00:00.000Z",
  "tables": [
    {
      "schema": "public",
      "name": "orders",
      "kind": "table",
      "comment": null,
      "columns": [{ "name": "status", "type": "order_status", "nullable": false, "comment": null }],
      "primaryKey": ["id"],
      "foreignKeys": [{ "columns": ["customer_id"], "references": { "schema": "public", "table": "customers", "columns": ["id"] } }]
    }
  ],
  "enums": [{ "schema": "public", "name": "order_status", "values": ["pending", "paid", "shipped", "delivered", "cancelled"] }]
}
```

### The card and "View structure" — `DataSourcesList`, `StructureViewer`

Each card shows the name, `user@host:port/database`, SSL, and the structure's state: "Structure not read yet", "Structure read {date}" in green, or "Couldn't read its structure: …" in red. Its buttons are Refresh structure, Edit and Delete.

**View structure** (`components/query/structure-viewer.tsx`) loads `GET /data-sources/:id/structure` only when opened. It's fetched again whenever `schema_refreshed_at` changes. It shows one collapsible row per table, with its column count. Opening a row shows each column's type, its enum values, 🔑 PK and 🔗 the table and column it references. Tables in `public` drop the schema prefix.

---

## Asking a question — `QueryRunner`, `query` function

`components/query/query-runner.tsx` → `POST /functions/v1/query { dataSourceId, question }`.

- Only connections with a read structure can be asked. With more than one, a picker appears.
- Enter asks; Shift+Enter adds a line. The question is up to 2000 characters.
- The panel states the limits: "Read-only · at most 500 rows · stops after 15 seconds".

**The function** (`supabase/functions/query/index.ts`):

1. Checks the caller is an admin (`401` / `403`), and that AI is configured (`503` "AI isn't configured…" when `AI_API_KEY` is unset).
2. Loads the connection and its structure JSON. If the structure was never read, it answers `400` "Use Refresh structure first".
3. **Writes the SQL** (`prompt.ts` → `generateQuery`): `describeStructure` turns the JSON into compact text, one line per column (`- customer_id integer not null → public.customers.id`), plus the enum values. `buildPrompt` adds the rules, and `requestJson` (`lib/aiClient.ts`) asks for `{ answerable, sql, explanation }`. The rules:
   - one read-only `SELECT` (CTEs allowed), never writes or several statements;
   - only the listed tables, schema-qualified;
   - clear column names, and order that answers the question;
   - a `LIMIT` of at most 500;
   - `ILIKE` for text;
   - today's date, to resolve "this year" or "last month";
   - `answerable: false` when the tables can't answer it;
   - the explanation in the question's language.
4. **Checks the SQL** (`checkSql.ts`): trailing semicolons are dropped. Anything that isn't a single statement starting with `SELECT` or `WITH` is refused and never sent.
5. **Runs it** (`runQuery.ts`), with the minimum safety agreed for now:
   - a **`READ ONLY` transaction**, so the database itself refuses any write;
   - **`statement_timeout` of 15 s**;
   - **at most 500 rows**: the query is wrapped as `select * from (<sql>) as query_result limit 501`, and the extra row sets `truncated`;
   - the password is read from Vault (`get_data_source_password`).
6. Answers `{ question, explanation, sql, columns, rows, truncated }`, or `{ question, explanation, sql, error }`.

**What the page shows:** the explanation, a collapsible **SQL used**, and the result table, with a sticky header, scrolling, and the row count ("Showing the first 500 rows; more matched." when truncated). On an error it shows the reason, plus the SQL when one was generated.

| Case | Message |
|---|---|
| Question can't be answered from these tables | The AI's explanation |
| Not a single SELECT | The generated SQL isn't a SELECT query / has more than one statement, so it wasn't run. |
| `57014` timeout | The query took longer than 15 seconds and was stopped. Try a narrower question. |
| `25006` write in read-only | The query tried to change data, and Query only reads. It wasn't run. |
| `42501` | The database user isn't allowed to read one of the tables this needs. |
| Anything else | The query failed: … |

---

## API

All endpoints are admins only, with the session token as bearer.

| Endpoint | What it does |
|---|---|
| `GET /data-sources?slug=` | The client's connections, by name |
| `POST /data-sources/test` | Tests details without saving. With `id`: a saved connection, with its stored password unless a new one is sent |
| `POST /data-sources` | `{ slug, name, type, host, port, database, username, password, ssl }` (`type`: `postgres` or `sqlserver`, default `postgres`): tests, saves and reads the structure (`201`) |
| `PATCH /data-sources/:id` | Same fields; an empty password keeps the stored one. Tests, saves, reads the structure again |
| `DELETE /data-sources/:id` | Removes the connection, its structure file and (trigger) its password |
| `POST /data-sources/:id/refresh-structure` | Reads the structure again. Answers with the updated row even when it fails (`schema_error`) |
| `GET /data-sources/:id/structure` | The stored structure JSON |
| `POST /query` | `{ dataSourceId, question }` → SQL plus rows, or the reason there are none |

---

## Database

**`portal.data_sources`** (migration `20261014120000_add_data_sources.sql`):

| Column | Notes |
|---|---|
| `id` | uuid PK |
| `customer_id` | → `portal.customers.customer_id`, `ON DELETE CASCADE` |
| `name` | Unique per client (`UNIQUE (customer_id, name)`) |
| `type` | `postgres` or `sqlserver` (`data_sources_type_check`, widened in `20261016120000_data_sources_sqlserver.sql`) |
| `host`, `port`, `database_name`, `username`, `ssl` | Connection details. Port 1–65535, SSL on by default |
| `password_secret_id` | The `vault.secrets` id holding the password. The password itself is never in the table |
| `schema_path`, `schema_refreshed_at`, `schema_error` | The structure file, when it was last read, and why the last read failed |
| `created_by` | → `portal.users.id`, `ON DELETE SET NULL` |
| `created_at`, `updated_at` | `updated_at` is set by trigger |

RLS is on with no policies: only the service role (edge functions) reads or writes it.

**Vault functions** (`SECURITY DEFINER`, execute granted to `service_role` only):
- `portal.set_data_source_password(id, password)` creates or replaces the secret (`data_source_password_<id>`).
- `portal.get_data_source_password(id)` returns it decrypted.
- The trigger `data_sources_delete_vault_secret` (migration `20261015120000_data_sources_delete_vault_secret.sql`) removes the secret when a row is deleted. It replaced `delete_data_source_password`.

**Bucket `data_source_schemas`:** private, JSON only, 5 MB per file, no policies (service role only).

---

## AI provider

Query uses the same shared client as suggested features and the debounce analyzers: `lib/aiClient.ts`, configured by `AI_BASE_URL`, `AI_MODEL` and `AI_API_KEY` (see `PORTAL_DOCS.md` §12). Changing them changes all four.

The model must support `json_schema` structured outputs. Writing correct SQL with joins needs a capable model; a very small model (e.g. a 3B one) often gets multi-table questions wrong.

---

## Trying it with a test database

The edge functions run in Supabase's cloud, so the database must be reachable from the internet. A free [Neon](https://neon.tech) project works; `localhost` doesn't.

Connect with a **read-only user**, never the owner.

**PostgreSQL:**

```sql
create role portal_reader with login password '<a long password>';
grant usage on schema public to portal_reader;
grant select on all tables in schema public to portal_reader;
alter default privileges in schema public grant select on tables to portal_reader;
```

**SQL Server / Azure SQL** (Azure SQL Database has a free offer; run in the database itself, e.g. the portal's Query editor):

```sql
CREATE USER portal_reader WITH PASSWORD = '<a strong password>';
ALTER ROLE db_datareader ADD MEMBER portal_reader;
```

Good questions to try, from simple to hard: counts per country; the most expensive products; orders per month in the last 6 months; best-selling products by units (joins); revenue per category; customers with no orders in 6 months. Also try the safeguards: "Delete the cancelled orders" must never run, and an unrelated question ("What's the weather?") should come back as not answerable.

---

## Tests

| Spec | What it covers |
|---|---|
| `tests/unit/query.spec.ts` (`--project=unit`) | `parseConnectionInput`, `describeConnectionError`, `readStructure` (with a fake driver), `checkSql`, `describeStructure` / `buildPrompt`. No database, AI or browser |
| `tests/e2e/query.spec.ts` (`--project=query`) | The page against mocked functions: menu item and empty state, connect (test failure, then success, then save), structure viewer, delete with confirmation, asking (explanation, SQL, rows) and a refused query. A customer is redirected from `/{slug}/query`. The **real** functions answer `401` without a session and `403` for a customer |

The pure helpers live in files with no Deno-only imports (`connectionInput.ts`, `connectionErrors.ts`, `introspect.ts`, `checkSql.ts`, `describeStructure.ts`) so these tests can load them.

---

## Not covered yet (deliberately deferred)

| Topic | Status |
|---|---|
| Query security beyond the minimum | Only the single-SELECT check, `READ ONLY`, the 15 s timeout and the 500-row cap. There's no SQL parsing, no per-client limits, and no enforced read-only user. A semicolon inside a string literal makes a query count as "more than one statement" |
| Network | Edge functions have no fixed IP. A client database behind a firewall needs an allow-list or another route |
| Other engines | PostgreSQL and SQL Server only. MySQL would be the next one: an entry in `ENGINES` with its driver, structure and dialect (see "Database engines") |
| Access for clients | Admins only (see "Who sees this page") |
| History | Questions and results aren't saved; reloading clears them |

---

## File map

| File | Role |
|---|---|
| `app/[slug]/(portal)/query/page.tsx` | The page: list query, empty and error states, the form, the runner |
| `components/query/data-source-form.tsx` | Connect / edit dialog with Test connection |
| `components/query/data-sources-list.tsx` | Connection cards, Refresh structure, Edit, Delete with confirmation, skeleton |
| `components/query/structure-viewer.tsx` | "View structure" on each card |
| `components/query/query-runner.tsx` | "Ask a question": picker, question, SQL used, results table |
| `lib/data-sources-api.ts` / `lib/query-api.ts` | Calls to the two functions, with the session token |
| `supabase/functions/data-sources/index.ts` | Router and admin check |
| `supabase/functions/data-sources/createDataSource.ts` | Test connection, create |
| `supabase/functions/data-sources/manageDataSources.ts` | List, saved-connection test, update, delete, refresh, get structure |
| `supabase/functions/data-sources/engines.ts` | The adapter per engine (`engineFor`) and `configFor` |
| `supabase/functions/data-sources/postgresClient.ts` | Postgres: one short-lived connection per call (`npm:postgres`) |
| `supabase/functions/data-sources/sqlserver.ts` | SQL Server: connection, catalog queries, run in an always-rolled-back transaction (`npm:mssql`) |
| `supabase/functions/data-sources/sqlserverStructure.ts` | SQL Server catalog rows → structure JSON (types, CHECK values) |
| `supabase/functions/data-sources/connectionErrors.ts` | Connection errors in plain words, per engine |
| `supabase/functions/data-sources/connectionInput.ts` | Form fields checked and normalized |
| `supabase/functions/data-sources/introspect.ts` | The catalog queries → `DatabaseStructure` |
| `supabase/functions/data-sources/refreshStructure.ts` | Read, upload JSON, record the outcome on the row |
| `supabase/functions/data-sources/columns.ts` | Public columns, bucket name |
| `supabase/functions/query/index.ts` | Question → SQL → rows |
| `supabase/functions/query/describeStructure.ts` | Structure as prompt text, the prompt, `MAX_ROWS` |
| `supabase/functions/query/prompt.ts` | The AI call (`generateQuery`) |
| `supabase/functions/query/checkSql.ts` | Single-SELECT guard |
| `supabase/functions/query/runQuery.ts` | Read-only run with timeout and row cap; query errors in plain words |
| `supabase/migrations/20261014120000_add_data_sources.sql` | Table, Vault functions, bucket |
| `supabase/migrations/20261015120000_data_sources_delete_vault_secret.sql` | Vault clean-up trigger |
| `supabase/migrations/20261016120000_data_sources_sqlserver.sql` | Allows `type = 'sqlserver'` |
