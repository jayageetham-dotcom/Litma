-- Writing statistics for writers (goals, streaks, the Statistics page) and a 90-day limit on
-- every statistics table, so the database never fills up (owner's rule, Nov 2026).
--
-- writing_days gets minutes spent writing and words per hour of the day (index 1 = 00:00).
-- work_days holds words and minutes per work per day. Both belong to the writer (RLS).
-- log_writing() is what the apps call after each save; add_words_today() stays for older apps.
-- prune_statistics() deletes rows older than 90 days from writing_days, work_days and
-- analytics_events; pg_cron runs it every night (03:10 India time).

alter table public.writing_days add column if not exists minutes int not null default 0;
alter table public.writing_days add column if not exists hours int[] not null default array_fill(0, array[24]);

create table if not exists public.work_days (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day date not null,
  document_id uuid not null references public.documents (id) on delete cascade,
  words int not null default 0,
  minutes int not null default 0,
  primary key (user_id, day, document_id)
);
create index if not exists work_days_document_idx on public.work_days (document_id);
alter table public.work_days enable row level security;
grant select, insert, update, delete on public.work_days to authenticated;
drop policy if exists "own work days" on public.work_days;
create policy "own work days" on public.work_days for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- n words added and mins minutes spent on the writer's own day d (their time zone), in work doc,
-- most of it in hour h (0–23). Security invoker: RLS applies.
create or replace function public.log_writing(n int, mins int default 0, d date default null, doc uuid default null, h int default null)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  dd date := coalesce(d, current_date);
  w int := greatest(coalesce(n, 0), 0);
  m int := least(greatest(coalesce(mins, 0), 0), 240);
begin
  if uid is null or (w = 0 and m = 0) then return; end if;
  -- a device clock far off (or a change queued offline long ago) counts today
  if dd < current_date - 3 or dd > current_date + 1 then dd := current_date; end if;
  insert into public.writing_days (user_id, day, words, minutes) values (uid, dd, w, m)
  on conflict (user_id, day) do update
    set words = public.writing_days.words + excluded.words,
        minutes = public.writing_days.minutes + excluded.minutes;
  if h between 0 and 23 and w > 0 then
    update public.writing_days set hours[h + 1] = coalesce(hours[h + 1], 0) + w where user_id = uid and day = dd;
  end if;
  if doc is not null then
    begin
      insert into public.work_days (user_id, day, document_id, words, minutes) values (uid, dd, doc, w, m)
      on conflict (user_id, day, document_id) do update
        set words = public.work_days.words + excluded.words,
            minutes = public.work_days.minutes + excluded.minutes;
    exception when foreign_key_violation then null; -- the work hasn't reached the server yet
    end;
  end if;
end $$;
revoke execute on function public.log_writing(int, int, date, uuid, int) from public, anon;
grant execute on function public.log_writing(int, int, date, uuid, int) to authenticated;

-- Keep 90 days of statistics.
create or replace function public.prune_statistics() returns void
language sql security definer set search_path = '' as $$
  delete from public.analytics_events where created_at < now() - interval '90 days';
  delete from public.writing_days where day < current_date - 90;
  delete from public.work_days where day < current_date - 90;
$$;
revoke execute on function public.prune_statistics() from public, anon, authenticated;

create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;
do $$ begin
  perform cron.unschedule('litma-prune-statistics');
exception when others then null; end $$;
select cron.schedule('litma-prune-statistics', '40 21 * * *', 'select public.prune_statistics()');
select public.prune_statistics();
