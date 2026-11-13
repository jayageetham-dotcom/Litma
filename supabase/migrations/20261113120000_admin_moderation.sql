-- Admin moderation of accounts (Nov 2026): the owner can block an account for some days or for
-- good, unblock it, or delete it, from /admin/ → Writers. The litma-admin function does the work
-- (Supabase Auth ban_duration, auth.admin.deleteUser) and writes every action here.

create table if not exists public.admin_actions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  admin_id uuid references auth.users (id) on delete set null,
  -- no foreign key: the account may be gone (deleted)
  target_id uuid not null,
  action text not null check (action in ('block', 'unblock', 'delete')),
  days integer,
  reason text check (char_length(reason) <= 500)
);
create index if not exists admin_actions_target on public.admin_actions (target_id, created_at desc);

-- only the service role (the litma-admin function) reads or writes it
alter table public.admin_actions enable row level security;
revoke all on public.admin_actions from anon, authenticated;

-- The writers list now says when an account is blocked until.
create or replace function public.admin_users(p_exclude_admins boolean default false)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
with
ev as (
  select user_id,
    max(created_at) as last_seen,
    count(*) as events,
    count(*) filter (where name = 'page_view') as page_views,
    count(distinct session_id) filter (where source = 'app') as sessions,
    count(distinct (created_at at time zone 'Asia/Kolkata')::date) as active_days,
    count(*) filter (where name = 'ai_request') as ai_requests,
    count(*) filter (where name = 'mcp_call') as mcp_calls,
    coalesce(sum((props ->> 'seconds')::numeric) filter (where name = 'engagement'), 0) as engaged_seconds,
    mode() within group (order by country) as country,
    mode() within group (order by platform) filter (where source = 'app') as platform,
    mode() within group (order by device) filter (where source = 'app') as device,
    mode() within group (order by os) filter (where source = 'app') as os,
    mode() within group (order by locale) filter (where source = 'app') as locale
  from public.analytics_events where user_id is not null group by user_id
),
wd as (select user_id, sum(words) as words, count(*) filter (where words > 0) as writing_days, max(day) as last_wrote from public.writing_days group by user_id),
dc as (select user_id, count(*) as works from public.documents where coalesce(settings ->> 'pristine', 'false') <> 'true' and not archived group by user_id),
bk as (select user_id, count(*) as books from public.books group by user_id)
select coalesce(jsonb_agg(row order by (row ->> 'last_seen') desc nulls last), '[]'::jsonb)
from (
  select jsonb_build_object(
    'id', u.id,
    'email', u.email,
    'name', coalesce(nullif(p.pen_name, ''), nullif(p.display_name, '')),
    'location', nullif(p.location, ''),
    'provider', coalesce(u.raw_app_meta_data ->> 'provider', 'email'),
    'joined', u.created_at,
    'confirmed', u.email_confirmed_at is not null,
    'last_sign_in', u.last_sign_in_at,
    'last_seen', greatest(ev.last_seen, wd.last_wrote::timestamptz, u.last_sign_in_at),
    'is_admin', exists (select 1 from public.app_admins a where a.user_id = u.id),
    'banned_until', case when u.banned_until > now() then u.banned_until end,
    'sessions', coalesce(ev.sessions, 0),
    'events', coalesce(ev.events, 0),
    'page_views', coalesce(ev.page_views, 0),
    'active_days', coalesce(ev.active_days, 0),
    'engaged_seconds', coalesce(ev.engaged_seconds, 0),
    'ai_requests', coalesce(ev.ai_requests, 0),
    'mcp_calls', coalesce(ev.mcp_calls, 0),
    'words', coalesce(wd.words, 0),
    'writing_days', coalesce(wd.writing_days, 0),
    'works', coalesce(dc.works, 0),
    'books', coalesce(bk.books, 0),
    'country', ev.country,
    'platform', ev.platform,
    'device', ev.device,
    'os', ev.os,
    'locale', ev.locale
  ) as row
  from auth.users u
  left join public.profiles p on p.id = u.id
  left join ev on ev.user_id = u.id
  left join wd on wd.user_id = u.id
  left join dc on dc.user_id = u.id
  left join bk on bk.user_id = u.id
  where not (p_exclude_admins and exists (select 1 from public.app_admins a where a.user_id = u.id))
) r;
$$;

revoke all on function public.admin_users(boolean) from public, anon, authenticated;
grant execute on function public.admin_users(boolean) to service_role;
