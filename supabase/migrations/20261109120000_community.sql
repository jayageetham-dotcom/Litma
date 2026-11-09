-- Litma Community (/community/): a forum for signed-in writers.
--
-- community_threads / community_replies: posts. Authors are filled in by a trigger from their
-- profile (pen name, else display name), so nobody can post under another name. Writers edit their
-- own posts while the thread is open and "delete" them by setting deleted_at (kept hidden for 180
-- days, then purged, so Litma can answer a lawful request about removed content).
-- community_likes: one like per writer per post. community_reports: a writer flags a post that breaks
-- the guidelines. community_members: who has agreed to the current guidelines, and who is barred
-- from posting. community_mod_log: every moderation action, for the owner's records.
--
-- Moderation (close, reopen, remove, restore, pin, bar a writer) goes through community_moderate()
-- and community_ban(), which check app_admins. Moderation fields and counters can't be changed by a
-- plain UPDATE: the triggers keep them unless the change comes from those functions
-- (the transaction-local setting litma.trusted = on).
--
-- Bump community_guidelines_version() when /community/guidelines/ changes in a way writers must
-- agree to again (and COMMUNITY_GUIDELINES_VERSION in apps/web/src/lib/community.ts).

create or replace function public.community_guidelines_version() returns text
language sql immutable set search_path = '' as $$ select '2026-11-09'::text $$;

-- ── tables ──

create table if not exists public.community_members (
  user_id uuid primary key references auth.users (id) on delete cascade,
  agreed_version text not null,
  agreed_at timestamptz not null default now(),
  banned_until timestamptz,
  ban_reason text check (char_length(ban_reason) <= 300)
);
alter table public.community_members enable row level security;
revoke all on public.community_members from anon, authenticated;

create table if not exists public.community_threads (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  author_name text not null default '',
  author_avatar text,
  author_tint text,
  category text not null default 'general' check (category in ('news', 'general', 'craft', 'language', 'feedback', 'help')),
  title text not null check (char_length(btrim(title)) between 3 and 140),
  body text not null check (char_length(btrim(body)) between 1 and 10000),
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  last_activity_at timestamptz not null default now(),
  reply_count int not null default 0,
  like_count int not null default 0,
  status text not null default 'open' check (status in ('open', 'closed', 'removed')),
  pinned boolean not null default false,
  mod_reason text,
  mod_note text check (char_length(mod_note) <= 500),
  moderated_at timestamptz,
  moderated_by uuid references auth.users (id) on delete set null,
  deleted_at timestamptz
);
create index if not exists community_threads_activity_idx on public.community_threads (pinned desc, last_activity_at desc) where deleted_at is null;
create index if not exists community_threads_author_idx on public.community_threads (author_id, created_at desc);
create index if not exists community_threads_moderated_by_idx on public.community_threads (moderated_by);
alter table public.community_threads enable row level security;

create table if not exists public.community_replies (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.community_threads (id) on delete cascade,
  author_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  author_name text not null default '',
  author_avatar text,
  author_tint text,
  body text not null check (char_length(btrim(body)) between 1 and 5000),
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  like_count int not null default 0,
  removed boolean not null default false,
  mod_reason text,
  moderated_at timestamptz,
  moderated_by uuid references auth.users (id) on delete set null,
  deleted_at timestamptz
);
create index if not exists community_replies_thread_idx on public.community_replies (thread_id, created_at);
create index if not exists community_replies_author_idx on public.community_replies (author_id, created_at desc);
create index if not exists community_replies_moderated_by_idx on public.community_replies (moderated_by);
alter table public.community_replies enable row level security;

create table if not exists public.community_likes (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  target_id uuid not null,
  target_kind text not null check (target_kind in ('thread', 'reply')),
  created_at timestamptz not null default now(),
  primary key (user_id, target_id)
);
create index if not exists community_likes_target_idx on public.community_likes (target_id);
alter table public.community_likes enable row level security;

create table if not exists public.community_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  thread_id uuid not null references public.community_threads (id) on delete cascade,
  reply_id uuid references public.community_replies (id) on delete cascade,
  reason text not null check (reason in ('hate', 'harassment', 'sexual', 'violence', 'privacy', 'copyright', 'spam', 'illegal', 'other')),
  note text check (char_length(note) <= 500),
  created_at timestamptz not null default now(),
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  resolved_at timestamptz,
  resolved_by uuid references auth.users (id) on delete set null
);
create unique index if not exists community_reports_once_idx on public.community_reports (reporter_id, thread_id, reply_id) nulls not distinct;
create index if not exists community_reports_open_idx on public.community_reports (status, created_at desc);
create index if not exists community_reports_thread_idx on public.community_reports (thread_id);
create index if not exists community_reports_reply_idx on public.community_reports (reply_id);
create index if not exists community_reports_resolved_by_idx on public.community_reports (resolved_by);
alter table public.community_reports enable row level security;

create table if not exists public.community_mod_log (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  admin_id uuid references auth.users (id) on delete set null,
  action text not null,
  thread_id uuid,
  reply_id uuid,
  user_id uuid,
  reason text,
  note text
);
create index if not exists community_mod_log_created_idx on public.community_mod_log (created_at desc);
create index if not exists community_mod_log_admin_idx on public.community_mod_log (admin_id);
alter table public.community_mod_log enable row level security;
revoke all on public.community_mod_log from anon, authenticated;

-- ── helpers used by the policies ──

create or replace function public.community_is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.app_admins a where a.user_id = (select auth.uid()));
$$;

create or replace function public.community_can_post() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.community_members m
    where m.user_id = (select auth.uid())
      and m.agreed_version = public.community_guidelines_version()
      and (m.banned_until is null or m.banned_until < now())
  );
$$;

revoke execute on function public.community_is_admin() from public, anon;
revoke execute on function public.community_can_post() from public, anon;
grant execute on function public.community_is_admin() to authenticated;
grant execute on function public.community_can_post() to authenticated;

-- ── policies (signed-in writers only; visitors see nothing) ──

revoke all on public.community_threads, public.community_replies, public.community_likes, public.community_reports from anon;
grant select, insert, update on public.community_threads to authenticated;
grant select, insert, update on public.community_replies to authenticated;
grant select, insert, delete on public.community_likes to authenticated;
grant select, insert on public.community_reports to authenticated;

drop policy if exists "read threads" on public.community_threads;
create policy "read threads" on public.community_threads for select to authenticated
  using ((deleted_at is null and (status <> 'removed' or author_id = (select auth.uid()))) or (select public.community_is_admin()));
drop policy if exists "start threads" on public.community_threads;
create policy "start threads" on public.community_threads for insert to authenticated
  with check (author_id = (select auth.uid()) and (select public.community_can_post()) and (category <> 'news' or (select public.community_is_admin())));
drop policy if exists "edit own threads" on public.community_threads;
create policy "edit own threads" on public.community_threads for update to authenticated
  using (author_id = (select auth.uid())) with check (author_id = (select auth.uid()));

drop policy if exists "read replies" on public.community_replies;
create policy "read replies" on public.community_replies for select to authenticated
  using (
    ((deleted_at is null and (not removed or author_id = (select auth.uid()))) or (select public.community_is_admin()))
    and exists (select 1 from public.community_threads t where t.id = thread_id)
  );
drop policy if exists "write replies" on public.community_replies;
create policy "write replies" on public.community_replies for insert to authenticated
  with check (
    author_id = (select auth.uid()) and (select public.community_can_post())
    and exists (select 1 from public.community_threads t where t.id = thread_id and t.status = 'open' and t.deleted_at is null)
  );
drop policy if exists "edit own replies" on public.community_replies;
create policy "edit own replies" on public.community_replies for update to authenticated
  using (author_id = (select auth.uid())) with check (author_id = (select auth.uid()));

drop policy if exists "read likes" on public.community_likes;
create policy "read likes" on public.community_likes for select to authenticated using (true);
drop policy if exists "like" on public.community_likes;
create policy "like" on public.community_likes for insert to authenticated
  with check (user_id = (select auth.uid()) and (select public.community_can_post()));
drop policy if exists "unlike" on public.community_likes;
create policy "unlike" on public.community_likes for delete to authenticated using (user_id = (select auth.uid()));

drop policy if exists "own reports" on public.community_reports;
create policy "own reports" on public.community_reports for select to authenticated
  using (reporter_id = (select auth.uid()) or (select public.community_is_admin()));
drop policy if exists "report" on public.community_reports;
create policy "report" on public.community_reports for insert to authenticated
  with check (reporter_id = (select auth.uid()) and status = 'open' and resolved_at is null and resolved_by is null);

-- ── triggers ──

create or replace function public.community_trusted() returns boolean
language sql stable set search_path = '' as $$ select coalesce(current_setting('litma.trusted', true), '') = 'on' $$;

-- New post: author from the profile, clean moderation fields, and a gentle rate limit.
create or replace function public.community_before_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  p record;
  recent int;
begin
  select coalesce(nullif(btrim(pr.pen_name), ''), nullif(btrim(pr.display_name), ''), 'Litma writer') as name,
         pr.preferences ->> 'avatar' as avatar, pr.preferences ->> 'avatarTint' as tint
    into p from public.profiles pr where pr.id = new.author_id;
  new.author_name := left(coalesce(p.name, 'Litma writer'), 80);
  new.author_avatar := left(p.avatar, 40);
  new.author_tint := left(p.tint, 20);
  new.created_at := now();
  new.edited_at := null;
  new.like_count := 0;
  new.moderated_at := null;
  new.moderated_by := null;
  new.mod_reason := null;
  new.deleted_at := null;
  if tg_table_name = 'community_threads' then
    new.status := 'open';
    new.pinned := false;
    new.mod_note := null;
    new.reply_count := 0;
    new.last_activity_at := now();
    select count(*) into recent from public.community_threads where author_id = new.author_id and created_at > now() - interval '1 hour';
    if recent >= 5 and not public.community_trusted() then
      raise exception 'community_slow_down' using errcode = 'P0001', hint = 'At most 5 new threads an hour.';
    end if;
  else
    new.removed := false;
    select count(*) into recent from public.community_replies where author_id = new.author_id and created_at > now() - interval '10 minutes';
    if recent >= 20 and not public.community_trusted() then
      raise exception 'community_slow_down' using errcode = 'P0001', hint = 'At most 20 replies in 10 minutes.';
    end if;
  end if;
  return new;
end $$;

-- Writers may edit text while the thread is open (deleting goes through community_delete_post).
-- Everything else stays as it was unless the change comes from the moderation functions.
create or replace function public.community_threads_before_update() returns trigger
language plpgsql set search_path = '' as $$
begin
  if public.community_trusted() then return new; end if;
  new.id := old.id; new.author_id := old.author_id; new.author_name := old.author_name;
  new.author_avatar := old.author_avatar; new.author_tint := old.author_tint; new.created_at := old.created_at;
  new.last_activity_at := old.last_activity_at; new.reply_count := old.reply_count; new.like_count := old.like_count;
  new.status := old.status; new.pinned := old.pinned; new.mod_reason := old.mod_reason; new.mod_note := old.mod_note;
  new.moderated_at := old.moderated_at; new.moderated_by := old.moderated_by;
  new.deleted_at := old.deleted_at;
  if old.status <> 'open' or old.deleted_at is not null then
    new.title := old.title; new.body := old.body; new.category := old.category;
  end if;
  if new.category = 'news' and old.category <> 'news' then new.category := old.category; end if;
  if new.title is distinct from old.title or new.body is distinct from old.body then
    new.edited_at := now();
  else
    new.edited_at := old.edited_at;
  end if;
  return new;
end $$;

create or replace function public.community_replies_before_update() returns trigger
language plpgsql set search_path = '' as $$
declare open_thread boolean;
begin
  if public.community_trusted() then return new; end if;
  new.id := old.id; new.thread_id := old.thread_id; new.author_id := old.author_id; new.author_name := old.author_name;
  new.author_avatar := old.author_avatar; new.author_tint := old.author_tint; new.created_at := old.created_at;
  new.like_count := old.like_count; new.removed := old.removed; new.mod_reason := old.mod_reason;
  new.moderated_at := old.moderated_at; new.moderated_by := old.moderated_by;
  new.deleted_at := old.deleted_at;
  select t.status = 'open' and t.deleted_at is null into open_thread from public.community_threads t where t.id = old.thread_id;
  if not coalesce(open_thread, false) or old.removed or old.deleted_at is not null then
    new.body := old.body;
  end if;
  if new.body is distinct from old.body then new.edited_at := now(); else new.edited_at := old.edited_at; end if;
  return new;
end $$;

-- Thread counters follow the visible replies.
create or replace function public.community_count_replies() returns trigger
language plpgsql security definer set search_path = '' as $$
declare tid uuid := coalesce(new.thread_id, old.thread_id);
begin
  perform set_config('litma.trusted', 'on', true);
  update public.community_threads t set
    reply_count = (select count(*) from public.community_replies r where r.thread_id = tid and not r.removed and r.deleted_at is null),
    last_activity_at = greatest(t.created_at, coalesce((select max(r.created_at) from public.community_replies r where r.thread_id = tid and not r.removed and r.deleted_at is null), t.created_at))
  where t.id = tid;
  perform set_config('litma.trusted', '', true);
  return null;
end $$;

create or replace function public.community_count_likes() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  tid uuid := coalesce(new.target_id, old.target_id);
  kind text := coalesce(new.target_kind, old.target_kind);
  n int;
begin
  select count(*) into n from public.community_likes where target_id = tid;
  perform set_config('litma.trusted', 'on', true);
  if kind = 'thread' then
    update public.community_threads set like_count = n where id = tid;
  else
    update public.community_replies set like_count = n where id = tid;
  end if;
  perform set_config('litma.trusted', '', true);
  return null;
end $$;

-- A like must point at a post the writer can see.
create or replace function public.community_likes_check() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.target_kind = 'thread' and not exists (select 1 from public.community_threads where id = new.target_id) then
    raise exception 'community_not_found' using errcode = 'P0002';
  elsif new.target_kind = 'reply' and not exists (select 1 from public.community_replies where id = new.target_id) then
    raise exception 'community_not_found' using errcode = 'P0002';
  end if;
  new.created_at := now();
  return new;
end $$;

drop trigger if exists community_threads_insert on public.community_threads;
create trigger community_threads_insert before insert on public.community_threads for each row execute function public.community_before_insert();
drop trigger if exists community_replies_insert on public.community_replies;
create trigger community_replies_insert before insert on public.community_replies for each row execute function public.community_before_insert();
drop trigger if exists community_threads_update on public.community_threads;
create trigger community_threads_update before update on public.community_threads for each row execute function public.community_threads_before_update();
drop trigger if exists community_replies_update on public.community_replies;
create trigger community_replies_update before update on public.community_replies for each row execute function public.community_replies_before_update();
drop trigger if exists community_replies_count on public.community_replies;
create trigger community_replies_count after insert or update of removed, deleted_at or delete on public.community_replies for each row execute function public.community_count_replies();
drop trigger if exists community_likes_check on public.community_likes;
create trigger community_likes_check before insert on public.community_likes for each row execute function public.community_likes_check();
drop trigger if exists community_likes_count on public.community_likes;
create trigger community_likes_count after insert or delete on public.community_likes for each row execute function public.community_count_likes();

-- ── functions the apps call ──

-- The writer's standing: agreed to the current guidelines? barred? admin?
create or replace function public.community_me() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'version', public.community_guidelines_version(),
    'agreed', coalesce(m.agreed_version = public.community_guidelines_version(), false),
    'agreed_at', m.agreed_at,
    'banned_until', case when m.banned_until > now() then m.banned_until end,
    'ban_reason', case when m.banned_until > now() then m.ban_reason end,
    'is_admin', public.community_is_admin()
  )
  from (select 1) one
  left join public.community_members m on m.user_id = (select auth.uid());
$$;

-- Agree to the guidelines (the version the writer was shown).
create or replace function public.community_agree(p_version text) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then raise exception 'not_signed_in' using errcode = '42501'; end if;
  if p_version is distinct from public.community_guidelines_version() then
    raise exception 'community_old_guidelines' using errcode = 'P0001';
  end if;
  insert into public.community_members (user_id, agreed_version, agreed_at)
  values ((select auth.uid()), p_version, now())
  on conflict (user_id) do update set agreed_version = excluded.agreed_version, agreed_at = excluded.agreed_at;
  return public.community_me();
end $$;

-- Admin actions on a thread or reply. Close/remove need a reason from the guidelines.
create or replace function public.community_moderate(p_action text, p_thread uuid, p_reply uuid default null, p_reason text default null, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare me uuid := (select auth.uid());
begin
  if not public.community_is_admin() then raise exception 'not_admin' using errcode = '42501'; end if;
  if p_action in ('close', 'remove', 'remove_reply') and coalesce(p_reason, '') not in ('hate', 'harassment', 'sexual', 'violence', 'privacy', 'copyright', 'spam', 'illegal', 'off_topic', 'other') then
    raise exception 'community_reason_needed' using errcode = 'P0001';
  end if;
  perform set_config('litma.trusted', 'on', true);
  case p_action
    when 'close' then
      update public.community_threads set status = 'closed', mod_reason = p_reason, mod_note = left(p_note, 500), moderated_at = now(), moderated_by = me where id = p_thread;
    when 'remove' then
      update public.community_threads set status = 'removed', pinned = false, mod_reason = p_reason, mod_note = left(p_note, 500), moderated_at = now(), moderated_by = me where id = p_thread;
    when 'reopen', 'restore' then
      update public.community_threads set status = 'open', mod_reason = null, mod_note = null, moderated_at = now(), moderated_by = me where id = p_thread;
    when 'pin' then
      update public.community_threads set pinned = true where id = p_thread and status <> 'removed';
    when 'unpin' then
      update public.community_threads set pinned = false where id = p_thread;
    when 'remove_reply' then
      update public.community_replies set removed = true, mod_reason = p_reason, moderated_at = now(), moderated_by = me where id = p_reply and thread_id = p_thread;
    when 'restore_reply' then
      update public.community_replies set removed = false, mod_reason = null, moderated_at = now(), moderated_by = me where id = p_reply and thread_id = p_thread;
    else
      raise exception 'community_unknown_action' using errcode = 'P0001';
  end case;
  if not found then raise exception 'community_not_found' using errcode = 'P0002'; end if;
  perform set_config('litma.trusted', '', true);
  if p_action in ('close', 'remove') then
    update public.community_reports set status = 'resolved', resolved_at = now(), resolved_by = me where thread_id = p_thread and status = 'open';
  elsif p_action = 'remove_reply' then
    update public.community_reports set status = 'resolved', resolved_at = now(), resolved_by = me where reply_id = p_reply and status = 'open';
  end if;
  insert into public.community_mod_log (admin_id, action, thread_id, reply_id, user_id, reason, note)
  values (me, p_action, p_thread, p_reply,
          coalesce((select author_id from public.community_replies where id = p_reply), (select author_id from public.community_threads where id = p_thread)),
          p_reason, left(p_note, 500));
end $$;

-- Bar a writer from posting for p_days days (null: until lifted; 0: lift it). Reading stays open.
create or replace function public.community_ban(p_user uuid, p_days int, p_reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  until timestamptz := case when p_days is null then 'infinity'::timestamptz when p_days <= 0 then null else now() + make_interval(days => p_days) end;
begin
  if not public.community_is_admin() then raise exception 'not_admin' using errcode = '42501'; end if;
  if p_user = me then raise exception 'community_not_yourself' using errcode = 'P0001'; end if;
  insert into public.community_members (user_id, agreed_version, banned_until, ban_reason)
  values (p_user, '', until, left(p_reason, 300))
  on conflict (user_id) do update set banned_until = excluded.banned_until, ban_reason = excluded.ban_reason;
  insert into public.community_mod_log (admin_id, action, user_id, reason)
  values (me, case when until is null then 'unban' else 'ban' end, p_user, left(p_reason, 300));
end $$;

-- A writer deletes their own thread or reply. It is hidden at once and purged after 180 days.
create or replace function public.community_delete_post(p_thread uuid, p_reply uuid default null)
returns void language plpgsql security definer set search_path = '' as $$
declare me uuid := (select auth.uid());
begin
  if me is null then raise exception 'not_signed_in' using errcode = '42501'; end if;
  perform set_config('litma.trusted', 'on', true);
  if p_reply is null then
    update public.community_threads set deleted_at = now(), pinned = false where id = p_thread and author_id = me and deleted_at is null;
  else
    update public.community_replies set deleted_at = now() where id = p_reply and thread_id = p_thread and author_id = me and deleted_at is null;
  end if;
  if not found then raise exception 'community_not_found' using errcode = 'P0002'; end if;
  perform set_config('litma.trusted', '', true);
end $$;

-- Reports for the admins' queue, with the post they point at.
create or replace function public.community_report_queue(p_status text default 'open')
returns table (
  id uuid, created_at timestamptz, status text, reason text, note text,
  thread_id uuid, thread_title text, thread_status text,
  reply_id uuid, excerpt text, author_id uuid, author_name text,
  reports_on_post bigint, author_banned_until timestamptz
) language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.community_is_admin() then raise exception 'not_admin' using errcode = '42501'; end if;
  return query
  select r.id, r.created_at, r.status, r.reason, r.note,
         t.id, t.title, t.status,
         rp.id, left(coalesce(rp.body, t.body), 280),
         coalesce(rp.author_id, t.author_id), coalesce(rp.author_name, t.author_name),
         (select count(*) from public.community_reports x where x.thread_id = r.thread_id and x.reply_id is not distinct from r.reply_id),
         (select m.banned_until from public.community_members m where m.user_id = coalesce(rp.author_id, t.author_id) and m.banned_until > now())
  from public.community_reports r
  join public.community_threads t on t.id = r.thread_id
  left join public.community_replies rp on rp.id = r.reply_id
  where p_status = 'all' or r.status = p_status
  order by r.created_at desc
  limit 200;
end $$;

create or replace function public.community_resolve_report(p_id uuid, p_status text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.community_is_admin() then raise exception 'not_admin' using errcode = '42501'; end if;
  if p_status not in ('open', 'resolved', 'dismissed') then raise exception 'community_bad_status' using errcode = 'P0001'; end if;
  update public.community_reports set status = p_status,
    resolved_at = case when p_status = 'open' then null else now() end,
    resolved_by = case when p_status = 'open' then null else (select auth.uid()) end
  where id = p_id;
end $$;

revoke execute on function public.community_me(), public.community_agree(text), public.community_delete_post(uuid, uuid),
  public.community_moderate(text, uuid, uuid, text, text), public.community_ban(uuid, int, text),
  public.community_report_queue(text), public.community_resolve_report(uuid, text) from public, anon;
grant execute on function public.community_me(), public.community_agree(text), public.community_delete_post(uuid, uuid),
  public.community_moderate(text, uuid, uuid, text, text), public.community_ban(uuid, int, text),
  public.community_report_queue(text), public.community_resolve_report(uuid, text) to authenticated;
revoke execute on function public.community_before_insert(), public.community_count_replies(),
  public.community_count_likes() from public, anon, authenticated;

-- ── retention: removed and deleted posts are kept 180 days (for lawful requests), then purged ──

create or replace function public.community_prune() returns void
language sql security definer set search_path = '' as $$
  delete from public.community_threads
   where deleted_at < now() - interval '180 days'
      or (status = 'removed' and moderated_at < now() - interval '180 days');
  delete from public.community_replies
   where deleted_at < now() - interval '180 days'
      or (removed and moderated_at < now() - interval '180 days');
  delete from public.community_reports where status <> 'open' and resolved_at < now() - interval '180 days';
  delete from public.community_mod_log where created_at < now() - interval '2 years';
$$;
revoke execute on function public.community_prune() from public, anon, authenticated;

create extension if not exists pg_cron with schema pg_catalog;
do $$ begin
  perform cron.unschedule('litma-prune-community');
exception when others then null; end $$;
select cron.schedule('litma-prune-community', '50 21 * * *', 'select public.community_prune()');
