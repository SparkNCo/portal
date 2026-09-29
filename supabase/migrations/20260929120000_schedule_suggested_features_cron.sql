-- Schedules supabase/functions/suggested-features/index.ts's /generate-all
-- route to run weekly, per the ticket ("Run a job weekly to generate these
-- objects"). Same pg_cron + pg_net pattern as
-- 20260812130100_schedule_linear_vector_sync_cron.sql.
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- Requires the same 'service_role_key' vault secret used by the other cron
-- jobs in this project. If it doesn't already exist, run manually first (NOT
-- part of this migration, so the raw key never lands in git):
--   select vault.create_secret('<your-service-role-key>', 'service_role_key');

do $$
declare
  job_name text := 'suggested-features-weekly';
begin
  if exists (select 1 from cron.job where jobname = job_name) then
    perform cron.unschedule(job_name);
  end if;

  perform cron.schedule(
    job_name,
    '0 6 * * 1', -- every Monday at 06:00 UTC — adjust to taste
    $cron$
    select net.http_post(
      url := 'https://ozybsusoollnomaaxkcy.supabase.co/functions/v1/suggested-features/generate-all',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
      ),
      body := '{}'::jsonb
    ) as request_id;
    $cron$
  );
end $$;
