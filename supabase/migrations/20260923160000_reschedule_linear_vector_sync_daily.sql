-- Dials linear-vector-sync back from hourly to daily (3am UTC) — the
-- per-run MAX_ISSUES_PER_RUN cap added alongside this (see
-- supabase/functions/linear-vector-sync/index.ts) means a big backlog now
-- takes a few runs to fully catch up instead of blowing the compute limit
-- in one, so an hourly cadence isn't needed to stay caught up day-to-day;
-- a customer's edits made directly in Linear (not through this app, which
-- already upserts inline on save) just take up to a day to show up in
-- search instead of up to an hour.
--
-- Renamed (not just rescheduled) so the job name reflects its real cadence.

do $$
declare
  old_job_name text := 'linear-vector-sync-hourly';
  job_name text := 'linear-vector-sync-daily';
begin
  if exists (select 1 from cron.job where jobname = old_job_name) then
    perform cron.unschedule(old_job_name);
  end if;

  if exists (select 1 from cron.job where jobname = job_name) then
    perform cron.unschedule(job_name);
  end if;

  perform cron.schedule(
    job_name,
    '0 3 * * *', -- daily at 3:00 AM UTC
    $cron$
    select net.http_post(
      url := 'https://ozybsusoollnomaaxkcy.supabase.co/functions/v1/linear-vector-sync',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
      ),
      body := '{}'::jsonb
    ) as request_id;
    $cron$
  );
end $$;
