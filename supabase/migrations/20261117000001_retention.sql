-- Retention and per-endpoint pruning.
-- pg_cron is enabled per project in the Supabase dashboard. This file creates
-- the function even when pg_cron is unavailable, and schedules the job only
-- when the extension is present.

create or replace function public.fishook_prune()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from events
   where received_at < now() - interval '72 hours';

  delete from ingest_rejections
   where at < now() - interval '1 hour';

  -- A schema without samples is a claim without evidence.
  delete from schemas s
   where not exists (
     select 1 from events e
      where e.endpoint_id = s.endpoint_id
        and e.event_type = s.event_type
   );

  -- Safety net for the 2,000 event cap. The ingest path prunes eagerly too.
  delete from events
   where id in (
     select id from (
       select id, row_number() over (
         partition by endpoint_id order by seq desc
       ) as rn
         from events
     ) ranked
     where ranked.rn > 2000
   );
end;
$$;

revoke all on function public.fishook_prune() from public;
revoke all on function public.fishook_prune() from anon, authenticated;
grant execute on function public.fishook_prune() to service_role;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'fishook-prune',
      '7 * * * *',
      $cron$select public.fishook_prune();$cron$
    );
  else
    raise notice 'pg_cron is not installed. Schedule public.fishook_prune() with the platform scheduler instead.';
  end if;
exception
  when others then
    raise notice 'fishook_prune was created, but the cron schedule failed: %', sqlerrm;
end;
$$;
