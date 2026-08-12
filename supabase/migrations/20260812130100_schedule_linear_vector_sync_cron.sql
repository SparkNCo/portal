-- Schedules the linear-vector-sync edge function (supabase/functions/linear-vector-sync/)
-- to catch issue edits made directly in Linear, so the Upstash issues vector index
-- doesn't only ever see edits made through this app. Same pg_cron + pg_net pattern as
-- 20260714140000_add_issueMetrics_and_dora_cron_jobs.sql.
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- Requires the same 'service_role_key' vault secret used by the other cron jobs in
-- this project. If it doesn't already exist, run manually first (NOT part of this
-- migration, so the raw key never lands in git):
--   select vault.create_secret('<your-service-role-key>', 'service_role_key');

do $$
begin
  if exists (select 1 from cron.job where jobname = 'linear-vector-sync-hourly') then
    perform cron.unschedule('linear-vector-sync-hourly');
  end if;
end $$;

select cron.schedule(
  'linear-vector-sync-hourly',
  '0 * * * *', -- every hour, on the hour — adjust to taste (was every 15 min, dialed back for free-tier usage)
  $$
  select net.http_post(
    url := 'https://ozybsusoollnomaaxkcy.supabase.co/functions/v1/linear-vector-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body := '{}'::jsonb
  ) as request_id;
  $$
);
