-- Litma Community: a writer can block another writer (App Store guideline 1.2: users must be able to
-- block abusive users).
--
-- community_blocks: one row per (blocker, blocked). The blocked writer's threads and replies disappear
-- for the blocker everywhere (the read policies below check this table), and the blocked writer is
-- never told. Writers see and manage only their own rows: Community → Blocked writers. The blocked
-- writer's name is copied from their profile when the block is made, so the list can show it
-- (writers can't read each other's profiles). Rows go with either account (ON DELETE CASCADE).

create table if not exists public.community_blocks (
  blocker_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  blocked_id uuid not null references auth.users (id) on delete cascade,
  blocked_name text not null default '',
  blocked_avatar text,
  blocked_tint text,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint community_blocks_not_self check (blocker_id <> blocked_id)
);
create index if not exists community_blocks_blocked_idx on public.community_blocks (blocked_id);
alter table public.community_blocks enable row level security;

revoke all on public.community_blocks from anon, authenticated;
grant select, insert, delete on public.community_blocks to authenticated;

drop policy if exists "own blocks" on public.community_blocks;
create policy "own blocks" on public.community_blocks for select to authenticated using (blocker_id = (select auth.uid()));
drop policy if exists "block" on public.community_blocks;
create policy "block" on public.community_blocks for insert to authenticated with check (blocker_id = (select auth.uid()));
drop policy if exists "unblock" on public.community_blocks;
create policy "unblock" on public.community_blocks for delete to authenticated using (blocker_id = (select auth.uid()));

-- Name and picture from the blocked writer's profile (the same name their posts show), and a limit.
create or replace function public.community_blocks_before_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  p record;
  n int;
begin
  select count(*) into n from public.community_blocks where blocker_id = new.blocker_id;
  if n >= 1000 then raise exception 'community_slow_down' using errcode = 'P0001', hint = 'At most 1000 blocked writers.'; end if;
  select coalesce(nullif(btrim(pr.pen_name), ''), nullif(btrim(pr.display_name), ''), 'Litma writer') as name,
         pr.preferences ->> 'avatar' as avatar, pr.preferences ->> 'avatarTint' as tint
    into p from public.profiles pr where pr.id = new.blocked_id;
  new.blocked_name := left(coalesce(p.name, 'Litma writer'), 80);
  new.blocked_avatar := left(p.avatar, 40);
  new.blocked_tint := left(p.tint, 20);
  new.created_at := now();
  return new;
end $$;
revoke execute on function public.community_blocks_before_insert() from public, anon, authenticated;

drop trigger if exists community_blocks_insert on public.community_blocks;
create trigger community_blocks_insert before insert on public.community_blocks for each row execute function public.community_blocks_before_insert();

-- Posts by writers the reader has blocked are not readable for that reader (admins included: an admin
-- who blocks someone sees their posts again by unblocking; the report queue is unaffected).
drop policy if exists "read threads" on public.community_threads;
create policy "read threads" on public.community_threads for select to authenticated
  using (
    ((deleted_at is null and (status <> 'removed' or author_id = (select auth.uid()))) or (select public.community_is_admin()))
    and not exists (select 1 from public.community_blocks b where b.blocker_id = (select auth.uid()) and b.blocked_id = community_threads.author_id)
  );

drop policy if exists "read replies" on public.community_replies;
create policy "read replies" on public.community_replies for select to authenticated
  using (
    ((deleted_at is null and (not removed or author_id = (select auth.uid()))) or (select public.community_is_admin()))
    and exists (select 1 from public.community_threads t where t.id = thread_id)
    and not exists (select 1 from public.community_blocks b where b.blocker_id = (select auth.uid()) and b.blocked_id = community_replies.author_id)
  );
