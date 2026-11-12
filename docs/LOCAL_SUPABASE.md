# Self-hosted Supabase (local)

A complete Supabase running on your machine with Docker: the same database structure, edge functions, Storage, Auth and Realtime the portal uses in the cloud, with its own test data. It's for development and tests. It doesn't replace the cloud project (`ozybsusoollnomaaxkcy`).

> **Before this goes to production, read [Cron jobs](#cron-jobs).** They're off locally on purpose. A self-hosted production instance without them silently stops updating its metrics, vector search and suggested features.

---

## Contents

1. [First-time setup (fresh clone)](#first-time-setup-fresh-clone)
2. [What runs](#what-runs)
3. [Start and stop](#start-and-stop)
4. [Links and sign-ins](#links-and-sign-ins)
5. [Files](#files)
6. [Generating the stack's secrets](#generating-the-stacks-secrets)
7. [Function secrets](#function-secrets)
8. [Database](#database)
9. [Test users and data](#test-users-and-data)
10. [Pointing the portal at it](#pointing-the-portal-at-it)
11. [Cron jobs](#cron-jobs)
12. [Production checklist](#production-checklist)
13. [Resetting](#resetting)
14. [Known differences from the cloud](#known-differences-from-the-cloud)

---

## First-time setup (fresh clone)

Everything needed to go from `git clone` to the portal running in Docker against this local Supabase, on port 3001. Run from the repo root in Git Bash (or any POSIX shell).

**Requirements:** Docker Desktop (running), Node.js, Git Bash on Windows.

**Env files** (none of them are in git; get the first three from the team):

| File | What it holds | Where it comes from |
|---|---|---|
| `.env` (root) | The portal's `NEXT_PUBLIC_*` values (Stripe, CometChat) | From the team |
| `.env.test` | The test users' emails and passwords | From the team |
| `docker/supabase/functions.env` | The edge functions' keys (Linear, Stripe, AI…) | From the team; check it with `node docker/supabase/portal/check-functions-env.mjs` |
| `docker/supabase/.env` | This stack's own secrets | **Generate your own** (step 0 below); never reuse someone else's |

```bash
# 0. The stack's own secrets: copy the template, then paste the printed
#    values over the matching empty lines in docker/supabase/.env.
cp docker/supabase/.env.example docker/supabase/.env
node docker/supabase/portal/generate-secrets.mjs

# 1. Start the local Supabase. The database starts empty; `rest` reports
#    unhealthy until step 2 creates the portal/marketing schemas.
cd docker/supabase && docker compose up -d && cd ../..

# 2. Load the cloud's database structure (no data) and its Storage buckets.
docker exec -i supabase-db psql -U postgres -d postgres < supabase/seed/baseline-roles.sql
docker exec -i supabase-db psql -U postgres -d postgres -1 < supabase/seed/baseline.sql
docker exec -i supabase-db psql -U postgres -d postgres < supabase/seed/storage.sql

# 3. Apply the migrations newer than that structure. Today that's only
#    20261105120000_pgvector_only.sql; when the baseline is older than other
#    migrations, apply each of them too (see "Database" for how to list them).
docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 -1 < supabase/migrations/20261105120000_pgvector_only.sql

# 4. Test users (one per role, from .env.test) and the test client
#    Spark-Portal. Both are safe to run again.
node docker/supabase/portal/seed-users.mjs
node docker/supabase/portal/seed-test-data.mjs

# 5. Build and start the portal against this stack, on port 3001.
ANON=$(grep '^ANON_KEY=' docker/supabase/.env | cut -d= -f2- | tr -d '"')
NEXT_PUBLIC_SUPABASE_URL=http://localhost:8000 \
NEXT_PUBLIC_SUPABASE_KEY="$ANON" \
NEXT_PUBLIC_SITE_URL=http://localhost:3001 \
PORT=3001 IMAGE_NAME=sparkco-portal-selfhosted \
docker compose -p portal-selfhosted up --build -d
```

Open http://localhost:3001 and sign in with a test user from `.env.test` (e.g. the admin). Studio is at http://localhost:8000 (sign in with `DASHBOARD_USERNAME` / `DASHBOARD_PASSWORD` from `docker/supabase/.env`).

Steps 0 to 4 are done once. After that:

| When | Run |
|---|---|
| Starting work (Supabase stopped) | `cd docker/supabase && docker compose up -d` |
| The portal's code changed (your edits, or a `git pull`) | Step 5 again: an image is a snapshot of the code when it was built, so the running portal doesn't change until it's rebuilt |
| A `git pull` brought new migrations | Apply each one (see [Database](#database)) |
| An edge function's code changed | Nothing: the functions read `supabase/functions` directly. If one doesn't pick it up: `docker compose restart functions` from `docker/supabase` |
| `docker/supabase/functions.env` changed | `docker compose up -d --force-recreate functions` from `docker/supabase`. A plain `restart` keeps the old values: the file is only read when the container is created |
| Done for the day | `docker compose -p portal-selfhosted down`, then `docker compose down` from `docker/supabase` (data is kept) |

The local Supabase itself is never "built": it runs images Supabase publishes. Data, tables, users and files live in `docker/supabase/volumes/` on your disk, so changes made in Studio or with SQL apply at once and survive restarts, but they stay on that machine. A structure change meant for production goes in a new file in `supabase/migrations/` instead.

The portal against the **cloud** in Docker is a different command, from the repo root with the root `.env`: `docker compose up --build -d` (port 3000, the same as `npm run dev`).

## What runs

Base: Supabase's official self-hosted stack, tag `self-hosted/v0.8.3`, in `docker/supabase/`. Every portal change lives in `docker/supabase/docker-compose.portal.yml` and `docker/supabase/portal/`. The upstream files are untouched except for removing the template's sample secrets (see the header of `docker-compose.portal.yml`).

| Service | Container | What it is |
|---|---|---|
| `api-gw` | `supabase-envoy` | Gateway on **port 8000**: every API call and Studio go through it |
| `db` | `supabase-db` | Postgres 17, also on **127.0.0.1:5433** |
| `auth` | `supabase-auth` | Sign-in (GoTrue) |
| `rest` | `supabase-rest` | Table API (PostgREST), with the `portal` and `marketing` schemas |
| `realtime` | `realtime-dev.supabase-realtime` | Live notifications and chat |
| `storage` | `supabase-storage` | Files (buckets) |
| `functions` | `supabase-edge-functions` | The repo's `supabase/functions`, mounted read-only |
| `studio` + `meta` | `supabase-studio`, `supabase-meta` | The dashboard |
| `mail` | `supabase-mail` | Mailpit: catches Auth emails so nothing is sent |

Off: `imgproxy` (the portal never asks for image transformations), `supavisor` (no pooler; Postgres is published directly), `analytics`/`vector` (dashboard logs). Uses about 1.2 GB of RAM.

Postgres is on 5433, not 5432, because 5432 is often taken by a native Postgres install. Change it with `POSTGRES_HOST_PORT` in `docker/supabase/.env`.

## Start and stop

Requires Docker Desktop running. From `docker/supabase/`:

```bash
docker compose up -d                # start (first time: downloads the images)
docker compose ps                   # every service should say "healthy"
docker compose logs -f functions    # function logs (Ctrl+C to leave; nothing stops)
docker compose restart functions    # after changing a function's code, if it isn't picked up
docker compose up -d --force-recreate functions   # after changing functions.env (restart keeps the old values)
docker compose down                 # stop; the data stays
```

The containers keep running after you close the terminal. Data survives `down`, a reboot or closing Docker Desktop: it lives in `docker/supabase/volumes/`.

Function code changes are picked up on the next call. If not, restart `functions`.

## Links and sign-ins

| What | Link | Sign in with |
|---|---|---|
| Studio (tables, SQL editor, users, storage) | http://localhost:8000 | `DASHBOARD_USERNAME` / `DASHBOARD_PASSWORD` in `docker/supabase/.env` |
| Mailpit (Auth emails) | http://localhost:8025 | — |
| Portal, when pointed here | http://localhost:3000 | The [test users](#test-users-and-data) |
| Postgres | `localhost:5433` | `postgres` / `POSTGRES_PASSWORD` in `docker/supabase/.env` |

## Files

| File | In git | What it is |
|---|---|---|
| `docker/supabase/docker-compose.yml` | Yes | Upstream, untouched |
| `docker/supabase/docker-compose.portal.yml` | Yes | Every portal change, plus how to update the upstream version |
| `docker/supabase/.env` | **No** | The stack's own secrets: Postgres password, JWT secret, anon/service keys, dashboard sign-in |
| `docker/supabase/.env.example` | Yes | Template for it, with every secret empty (see [Generating the stack's secrets](#generating-the-stacks-secrets)) |
| `docker/supabase/functions.env` | **No** | The edge functions' secrets |
| `docker/supabase/functions.env.example` | Yes | Their names, no values |
| `docker/supabase/portal/functions-main/` | Yes | Function router: checks the JWT per function, like the cloud |
| `docker/supabase/portal/generate-secrets.mjs` | Yes | Prints fresh values for the stack's secrets |
| `docker/supabase/portal/check-functions-env.mjs` | Yes | Compares `functions.env` with the cloud's secrets |
| `docker/supabase/portal/seed-users.mjs` | Yes | Test users |
| `docker/supabase/portal/seed-test-data.mjs` | Yes | Test client and its links |
| `supabase/seed/baseline-roles.sql`, `baseline.sql` | Yes | The cloud's database structure (no data, no secrets) |
| `supabase/seed/storage.sql` | Yes | The cloud's buckets and their policies |

## Generating the stack's secrets

`docker/supabase/.env.example` has **every secret empty** on purpose. Supabase's template ships public demo values there (a `JWT_SECRET`, and `ANON_KEY` / `SERVICE_ROLE_KEY` signed with it, issuer `supabase-demo`): anyone who knows them could sign in as admin to a stack that kept them. Generate your own:

```bash
cp docker/supabase/.env.example docker/supabase/.env   # first time only
node docker/supabase/portal/generate-secrets.mjs        # prints fresh values
```

Paste its output over the matching empty lines in `docker/supabase/.env`. It prints `POSTGRES_PASSWORD`, `JWT_SECRET`, `ANON_KEY` and `SERVICE_ROLE_KEY` (HS256 JWTs signed with that `JWT_SECRET`), `DASHBOARD_PASSWORD`, `SECRET_KEY_BASE`, `VAULT_ENC_KEY` (32 characters), `PG_META_CRYPTO_KEY` and the two `S3_PROTOCOL_*` values. Nothing is written to disk; every run gives new values.

The newer asymmetric keys (`SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `JWT_KEYS`, `JWT_JWKS`, `*_ASYMMETRIC`) are optional: the compose file has defaults for them and the portal uses the legacy anon key. Upstream generates them with `utils/add-new-auth-keys.sh` (same tag), which isn't copied here.

**Rotating them on a running stack:**

- `JWT_SECRET`, `ANON_KEY`, `SERVICE_ROLE_KEY` change together. Everyone gets signed out, and the portal's `NEXT_PUBLIC_SUPABASE_KEY` (`.env.local`, or the portal image's build arg) must be updated to the new `ANON_KEY`. The seed scripts read the service key from `.env`, so they keep working.
- `POSTGRES_PASSWORD` is only applied when the database is first created. On an existing one, change the roles' password in Postgres as well (`alter role postgres with password '…'`, and the same for `authenticator`, `supabase_auth_admin`, `supabase_storage_admin`, etc.), or [reset](#resetting).
- `VAULT_ENC_KEY`: whatever was stored in Vault with the old key can't be read with the new one.
- After editing, `docker compose up -d` from `docker/supabase/` recreates the services that changed.

Never reuse these values in another environment, and never commit `docker/supabase/.env`: it's git-ignored by `docker/supabase/.gitignore`.

## Function secrets

The functions read **`docker/supabase/functions.env`**, not `supabase/functions/.env`:

| File | Read by |
|---|---|
| `docker/supabase/functions.env` | The local stack's `functions` container (`env_file`) |
| `supabase/functions/.env` | The Supabase CLI against the cloud, and the e2e tests |

The compose file always sets these four itself, whatever `functions.env` says, so local functions can't write to the cloud database:

| Variable | Local value |
|---|---|
| `PROJECT_URL` | `http://supabase.localhost:8000` (the gateway; browsers map `*.localhost` to this machine, so Storage URLs work from the browser too) |
| `SERVICE_SECRET_KEY` | The local service key |
| `APP_URL` | `http://localhost:3000` |
| `VERIFY_JWT` | `true`, except for `cometchat` (`FUNCTIONS_NO_VERIFY_JWT`), as in the cloud |

**Check them against the cloud** (from the repo root, Supabase CLI logged in). The cloud only exposes a SHA-256 digest of each secret, so no value is printed:

```bash
node docker/supabase/portal/check-functions-env.mjs
```

Write values as `NAME=value` or `NAME="value"`. Don't put a comment on the same line (`NAME="value" # note` makes the comment part of the value). Put it on the line above instead.

> **The external keys are production's.** Linear, Stripe, Resend, CometChat and the AI provider are the real ones, so what local functions do there really happens: a ticket created locally exists in Linear, a mail sent locally reaches its inbox. To keep a mail from going out, leave `RESEND_KEY` and `SMTP_*` empty.

## Database

**Structure.** The repo's migrations start in June 2026, but the base tables were made earlier from the dashboard, so the migrations alone don't build the database. `supabase/seed/baseline.sql` is a dump of the cloud's structure (`npx supabase db dump --linked`): schemas `portal`, `marketing`, `stripe`, `portaldev`, `external`, RLS policies and the Realtime publication. No data. `baseline-roles.sql` holds the roles. `storage.sql` holds the 7 buckets and their `storage.objects` policies.

Load them in an empty database, in this order:

```bash
docker exec -i supabase-db psql -U postgres -d postgres < supabase/seed/baseline-roles.sql
docker exec -i supabase-db psql -U postgres -d postgres -1 < supabase/seed/baseline.sql
docker exec -i supabase-db psql -U postgres -d postgres < supabase/seed/storage.sql
```

**Migrations.** The cloud has no migration history (they were applied by hand), so the local history in `supabase_migrations.schema_migrations` was filled in by hand too. A new migration is applied and registered like this:

```bash
docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 -1 < supabase/migrations/<file>.sql
docker exec supabase-db psql -U postgres -d postgres -c \
  "insert into supabase_migrations.schema_migrations(version, name) values ('<version>', '<name>') on conflict do nothing;"
```

List the ones still missing locally:

```bash
for f in supabase/migrations/*.sql; do
  v=$(basename "$f" | cut -d_ -f1)
  n=$(docker exec supabase-db psql -U postgres -d postgres -Atc \
    "select count(*) from supabase_migrations.schema_migrations where version='$v'")
  [ "$n" = "0" ] && echo "$f"
done
```

**Regenerate the baseline** when the cloud changes outside the migrations: `npx supabase db dump --linked --role-only -f supabase/seed/baseline-roles.sql` and `npx supabase db dump --linked -f supabase/seed/baseline.sql`. Check the dump carries no secrets before committing it.

**Vault isn't copied.** The cloud's secrets are encrypted with another key. Query connections are created again from the page.

## Test users and data

Two scripts, run from the repo root with the stack up. Both only call `localhost:8000` and are safe to run again: nothing is duplicated.

```bash
node docker/supabase/portal/seed-users.mjs       # 1. users
node docker/supabase/portal/seed-test-data.mjs   # 2. client and links
```

**`seed-users.mjs`** creates one user per role, with the emails and passwords in `.env.test` (the ones the e2e tests sign in with): the Auth account, through GoTrue's admin API, and its `portal.users` row. Running it again resets their passwords to `.env.test`'s.

| Role | `.env.test` variables |
|---|---|
| admin | `TEST_ADMIN_EMAIL`, `TEST_PASSWORD` |
| developer | `TEST_DEVELOPER_EMAIL`, `TEST_PASSWORD` |
| customer | `TEST_CUSTOMER_EMAIL`, `TEST_PASSWORD` |
| stakeholder | `TEST_HOLDER_EMAIL`, `TEST_PASSWORD` |

**`seed-test-data.mjs`** creates the client **Spark-Portal** (`linear_slug` `f12c1e4fa44b`, its 8 `linear_projects` and `project_url` `https://github.com/SparkNCo/portal`, copied from the cloud; `billing_mode` `manual`, so nothing is created in Stripe) and links the users the way the portal does:

- **customer:** `portal.users.customer_id` → `portal.customers.customer_id`.
- **developer and stakeholder:** a `portal.assignments` row whose `customer_id` is the customer **user's** `portal.users.id`, with its id appended to both users' `assignment_id` (as `assignments/createAssignment.ts` does).

Linear tickets, projects and milestones aren't copied: the portal reads them live from Linear through `linear_slug`. Metrics are filled by running the functions, see [Cron jobs](#cron-jobs).

## Pointing the portal at it

Create `.env.local` in the repo root. Next.js reads it over `.env`, so `.env` stays as it is:

```
NEXT_PUBLIC_SUPABASE_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_KEY=<ANON_KEY from docker/supabase/.env>
```

Restart `npm run dev`, sign out (the old session belongs to the cloud) and sign in with a test user. If the admin lists show only the test users, you're on the local stack.

**Back to the cloud:** rename or delete `.env.local` and restart `npm run dev`. While it exists, everything done on `localhost:3000` goes to the local database.

### A second deploy against this stack

The portal's Docker image bakes `NEXT_PUBLIC_*` in at build time, so the backend a deploy uses is decided when it's built. This builds a **separate** deploy (its own image, container and port 3001) against the local stack, while the usual one keeps pointing at the cloud. From the repo root:

```bash
ANON=$(grep '^ANON_KEY=' docker/supabase/.env | cut -d= -f2- | tr -d '"')
NEXT_PUBLIC_SUPABASE_URL=http://localhost:8000 \
NEXT_PUBLIC_SUPABASE_KEY="$ANON" \
NEXT_PUBLIC_SITE_URL=http://localhost:3001 \
PORT=3001 IMAGE_NAME=sparkco-portal-selfhosted \
docker compose -p portal-selfhosted up --build -d
```

Open http://localhost:3001 and sign in with a test user. Variables set in the shell win over `.env`, so `.env` isn't touched. `-p portal-selfhosted` and `IMAGE_NAME` keep this deploy apart from the default `sparkco-portal`.

Stop it with `docker compose -p portal-selfhosted down`.

It works with `localhost:8000` because the portal calls Supabase **from the browser**, and the browser runs on this machine. The only server-side Supabase calls are the server actions in `app/actions.ts`, used by the old template pages `/sign-in` and `/protected/reset-password`, not by the portal's login: inside the container `localhost` is the container itself, so those would fail. On a real server, use the stack's public address instead of `localhost:8000` and both work.

Functions redirect to `APP_URL` (`http://localhost:3000`, set in `docker-compose.portal.yml`), so a redirect from a function lands on port 3000, not 3001.

## Cron jobs

### Locally: off, on purpose

The baseline doesn't carry `cron.job` (it's data, not structure), and the cron migrations hardcode the cloud's URL. Scheduling them as they are would make the local database call **production** functions every day. So the local stack has **no cron jobs**: nothing updates on its own, even with Docker running 24/7.

Check it any time:

```sql
select jobid, jobname, schedule, command from cron.job;
-- must be empty, and nothing may contain ozybsusoollnomaaxkcy
```

### What they do

| Job | Schedule (UTC) | Calls | Feeds | Without it |
|---|---|---|---|---|
| `issueMetrics-daily` | 06:00 daily | `POST /issueMetrics {}` | `cycle_metrics`, `issue_metrics` | **Cycle Scope vs Completed** and the cycle/issue metrics stop updating |
| `dora-allCustomers-daily` | 06:30 daily | `POST /dora {"method":"allCustomers"}` | `dora_metrics`, `dora_branch_events` | **SDLC Metrics** freeze; a new customer never gets any |
| `linear-vector-sync-daily` | 03:00 daily | `POST /linear-vector-sync {}` | pgvector embeddings of Linear issues | Similar-issue search and AI context miss every new ticket |
| `suggested-features-weekly` | Mondays 06:00 | `POST /suggested-features/generate-all {}` | Suggested Features | No new suggestions in Build |

Defined in `supabase/migrations/20260714140000_add_issueMetrics_and_dora_cron_jobs.sql`, `20260923160000_reschedule_linear_vector_sync_daily.sql` and `20260929120000_schedule_suggested_features_cron.sql`. Each one calls the function with `pg_net`, authenticated with the service key stored in Vault as `service_role_key`.

The cloud may have jobs created from the dashboard that aren't in any migration (for example for `milestone-snapshots`, a function that's only in the cloud). Before relying on this list, compare it with `select jobname, schedule, command from cron.job;` run in the cloud's SQL editor.

### Running them by hand (locally)

From the repo root. They read from Linear/GitHub and write to the local database:

```bash
SK=$(grep '^SERVICE_ROLE_KEY=' docker/supabase/.env | cut -d= -f2- | tr -d '"')
H=(-H "Authorization: Bearer $SK" -H "Content-Type: application/json")
curl -X POST http://localhost:8000/functions/v1/issueMetrics "${H[@]}" -d '{}'
curl -X POST http://localhost:8000/functions/v1/dora "${H[@]}" -d '{"method":"allCustomers"}'
curl -X POST http://localhost:8000/functions/v1/linear-vector-sync "${H[@]}" -d '{}'
curl -X POST http://localhost:8000/functions/v1/suggested-features/generate-all "${H[@]}" -d '{}'
```

`suggested-features` uses the AI provider and creates suggestions; `linear-vector-sync` embeds every ticket and can take a while.

### Turning them on (self-hosted)

Needed for a self-hosted **production** instance, optional locally. Inside the stack, Postgres reaches the functions through the gateway at `http://api-gw:8000`; never use the cloud's URL.

```sql
-- 1. The service key the jobs authenticate with (the stack's SERVICE_ROLE_KEY).
select vault.create_secret('<SERVICE_ROLE_KEY>', 'service_role_key');

-- 2. One job per function. Same schedules as the cloud.
select cron.schedule('issueMetrics-daily', '0 6 * * *', $$
  select net.http_post(
    url := 'http://api-gw:8000/functions/v1/issueMetrics',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')),
    body := '{}'::jsonb);
$$);

select cron.schedule('dora-allCustomers-daily', '30 6 * * *', $$
  select net.http_post(
    url := 'http://api-gw:8000/functions/v1/dora',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')),
    body := jsonb_build_object('method', 'allCustomers'));
$$);

select cron.schedule('linear-vector-sync-daily', '0 3 * * *', $$
  select net.http_post(
    url := 'http://api-gw:8000/functions/v1/linear-vector-sync',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')),
    body := '{}'::jsonb);
$$);

select cron.schedule('suggested-features-weekly', '0 6 * * 1', $$
  select net.http_post(
    url := 'http://api-gw:8000/functions/v1/suggested-features/generate-all',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')),
    body := '{}'::jsonb);
$$);

-- 3. Check: 4 jobs, none pointing at ozybsusoollnomaaxkcy.
select jobname, schedule, command from cron.job;

-- After the first scheduled run: each call's result.
select id, status_code, left(content::text, 200) from net._http_response order by id desc limit 10;
```

To stop one: `select cron.unschedule('issueMetrics-daily');`.

## Production checklist

If this stack ever becomes production, these have to be done. Otherwise it goes live with features silently off.

- [ ] **Cron jobs scheduled** against the self-hosted gateway ([Turning them on](#turning-them-on-self-hosted)), compared with the cloud's `cron.job`, and the first run checked in `net._http_response`.
- [ ] **Data migrated.** The baseline is structure only: production needs a data dump (`pg_dump --data-only`, or `npx supabase db dump --linked --data-only`), Storage files, and Auth users.
- [ ] **Vault secrets re-created**, since they can't be copied: `service_role_key` and every Query connection.
- [ ] **New secrets** for the stack (`node docker/supabase/portal/generate-secrets.mjs`): `JWT_SECRET`, anon/service keys, `POSTGRES_PASSWORD`, `DASHBOARD_PASSWORD`, `VAULT_ENC_KEY`. Never reuse the local ones, and never the template's demo values.
- [ ] **Real SMTP** for Auth instead of Mailpit, and `SITE_URL` / `ADDITIONAL_REDIRECT_URLS` / `API_EXTERNAL_URL` with the public address.
- [ ] **HTTPS** in front of the gateway (reverse proxy), and Postgres not published to the internet.
- [ ] **Backups**: self-hosted has no automatic backups or point-in-time recovery.
- [ ] **The 10 functions that are only in the cloud** brought into the repo or replaced (see below).
- [ ] **Webhooks** (GitHub, Stripe, Linear) pointed at the new URL, with their secrets set.

## Resetting

Deletes every local row, user and file:

```bash
cd docker/supabase
docker compose down
rm -rf volumes/db/data volumes/storage
docker compose up -d
cd ../..
# Then: load the baseline (see Database), apply the newer migrations, and
node docker/supabase/portal/seed-users.mjs
node docker/supabase/portal/seed-test-data.mjs
```

## Known differences from the cloud

- **Cron jobs:** off (see above). Metrics only hold what was computed the last time someone ran the functions. The cloud has months of daily history.
- **Functions only in the cloud:** 10 deployed functions aren't in the repo, so they don't exist locally: `stripe-webhook`, `stripe-worker`, `stripe-setup`, `create-lead`, `doraMetrics`, `getDeployFrec`, `decisions`, `test`, `stripe-test`, `milestone-snapshots`. For example, `milestone_cycle_snapshots` stays empty.
- **Deno 2.1.4** in the edge runtime (`v1.77.4`): SQL Server connections in Query need Deno ≥ 2.7 and don't work locally.
- **Foreign tables** in `external` (Airtable, Cal.com, Notion, through wrappers) read their credentials from Vault, so they don't work locally.
- **`health`** has no `Deno.serve`, so calling it hangs.
- **`GITHUB_WEBHOOK_SECRET`** isn't set, neither here nor in the cloud, so `github-webhook` always answers 500. DORA falls back to each branch's first commit date, which makes Lead Time and cycle times look slightly shorter.
- **Storage policy:** in the cloud, `signatures_bucket` lets anyone (anon) insert, update and delete. Copied as is.
