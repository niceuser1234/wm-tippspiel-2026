-- 0012_cron_sync_fixtures.sql
-- Schedules the `sync-fixtures` Edge Function every 30 min via pg_cron + pg_net,
-- to auto-insert knockout pairings (R32..Final) as ESPN publishes them.
-- Mirror of 0010_cron_sync_scores.sql. Re-runnable. Contains NO secrets — the
-- service-role bearer is read from Vault at call time.
--
-- Reuses the EXISTING Vault secret `sync_scores_service_role_key` (created for
-- 0010). No new secret needed.

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net  with schema extensions;

do $$
begin
  perform cron.unschedule('sync-wm-fixtures');
exception
  when others then null; -- job did not exist yet
end $$;

select cron.schedule(
  'sync-wm-fixtures',
  '*/30 * * * *',
  $cron$
  select net.http_post(
    url     := 'https://wmoqthevlthvfeazdqlh.supabase.co/functions/v1/sync-fixtures',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'sync_scores_service_role_key'
      ),
      'Content-Type', 'application/json'
    ),
    body    := '{}'::jsonb
  );
  $cron$
);
