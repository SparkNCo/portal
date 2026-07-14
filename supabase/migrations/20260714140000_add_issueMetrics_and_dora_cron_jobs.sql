-- Splits the combined issueMetrics+DORA cron into two independent jobs.
-- issueMetrics (Linear issue/cycle metrics) no longer triggers dora per
-- customer inline (see issueMetrics/index.ts) — dora now has its own
-- "allCustomers" method and runs on its own schedule, so a slow/rate-limited
-- GitHub run never delays or times out the Linear metrics run.
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- One-time setup, run manually in the SQL editor (NOT part of this
-- migration, so the raw key never lands in git):
--   select vault.create_secret('<your-service-role-key>', 'service_role_key');
-- If a secret with that name already exists, skip this step.

do $$
begin
  if exists (select 1 from cron.job where jobname = 'issueMetrics-daily') then
    perform cron.unschedule('issueMetrics-daily');
  end if;
  if exists (select 1 from cron.job where jobname = 'dora-allCustomers-daily') then
    perform cron.unschedule('dora-allCustomers-daily');
  end if;
end $$;

-- Linear issue/cycle metrics — independent cron.
select cron.schedule(
  'issueMetrics-daily',
  '0 6 * * *', -- 06:00 UTC daily — adjust to taste
  $$
  select net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/issueMetrics',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body := '{}'::jsonb
  ) as request_id;
  $$
);

-- DORA metrics for all eligible customers — own cron, offset from
-- issueMetrics so they're not both hammering GitHub/Linear API budget at
-- the same time.
select cron.schedule(
  'dora-allCustomers-daily',
  '30 6 * * *', -- 06:30 UTC daily — adjust to taste
  $$
  select net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/dora',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body := jsonb_build_object('method', 'allCustomers')
  ) as request_id;
  $$
);
