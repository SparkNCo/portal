-- Daily cron for the milestone-snapshots function (see
-- supabase/functions/milestone-snapshots/) — freezes each roadmap
-- milestone's status for cycles that closed since the last run, into
-- portal.milestone_cycle_snapshots.
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- One-time setup, run manually in the SQL editor (NOT part of this
-- migration, so the raw key never lands in git) if not already done for the
-- other crons in this project:
--   select vault.create_secret('<your-service-role-key>', 'service_role_key');

do $$
begin
  if exists (select 1 from cron.job where jobname = 'milestone-snapshots-daily') then
    perform cron.unschedule('milestone-snapshots-daily');
  end if;
end $$;

-- Offset from issueMetrics (06:00) and dora (06:30) so all three don't hit
-- Linear's API budget at the same moment.
select cron.schedule(
  'milestone-snapshots-daily',
  '0 7 * * *', -- 07:00 UTC daily — adjust to taste
  $$
  select net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/milestone-snapshots',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body := jsonb_build_object('method', 'allCustomers')
  ) as request_id;
  $$
);
