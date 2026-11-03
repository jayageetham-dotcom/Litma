-- Usage analytics for the owner's /admin/ page.
--
-- analytics_events: page views, clicks on Litma's own buttons (only labels from the app's interface,
-- never writing), feature use (new work, export, AI, dictionary, MCP) and engaged time. No IP addresses,
-- no writing content, no titles. Written only by the litma-track / litma-ai / litma-mcp Edge Functions
-- (service role); read only by litma-admin after it checks app_admins. Browsers have no access at all
-- (RLS on, no policies, privileges revoked), the same pattern as ai_keys.
--
-- app_admins: who may open /admin/. Add someone with
--   insert into public.app_admins (user_id) select id from auth.users where email = '…';

create table if not exists public.app_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.app_admins enable row level security;
revoke all on public.app_admins from anon, authenticated;

create table if not exists public.analytics_events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  user_id uuid references auth.users (id) on delete cascade,
  -- random ids made by the browser: one per device (visitor) and one per visit (session)
  visitor_id text not null check (char_length(visitor_id) between 1 and 64),
  session_id text not null check (char_length(session_id) between 1 and 64),
  -- 'app' for events sent by the apps, 'server' for ones recorded by Edge Functions (AI, MCP)
  source text not null default 'app' check (source in ('app', 'server')),
  name text not null check (name ~ '^[a-z][a-z0-9_]{1,39}$'),
  path text check (char_length(path) <= 200),
  label text check (char_length(label) <= 120),
  props jsonb not null default '{}'::jsonb,
  referrer text check (char_length(referrer) <= 120),
  platform text check (char_length(platform) <= 20),
  device text check (char_length(device) <= 20),
  os text check (char_length(os) <= 30),
  browser text check (char_length(browser) <= 30),
  lang text check (char_length(lang) <= 20),
  locale text check (char_length(locale) <= 10),
  tz text check (char_length(tz) <= 60),
  country text check (char_length(country) <= 2),
  screen text check (char_length(screen) <= 20),
  app_version text check (char_length(app_version) <= 30)
);
alter table public.analytics_events enable row level security;
revoke all on public.analytics_events from anon, authenticated;

create index if not exists analytics_events_created_idx on public.analytics_events (created_at desc);
create index if not exists analytics_events_user_idx on public.analytics_events (user_id, created_at desc) where user_id is not null;
create index if not exists analytics_events_visitor_idx on public.analytics_events (visitor_id);
create index if not exists analytics_events_session_idx on public.analytics_events (session_id);

-- ── Reports (service role only; litma-admin calls them after checking app_admins) ──

-- Everything on the Overview, Audience and Behaviour tabs, for the last p_days days
-- (with the period before it for comparison). Days and hours are in India time.
create or replace function public.admin_dashboard(p_days integer default 30, p_exclude_admins boolean default true)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
with
params as (
  select now() - make_interval(days => p_days) as t0,
         now() - make_interval(days => 2 * p_days) as tp,
         ((now() at time zone 'Asia/Kolkata')::date - (p_days - 1)) as d0,
         ((now() at time zone 'Asia/Kolkata')::date - (2 * p_days - 1)) as dp
),
admins as (select user_id from public.app_admins where p_exclude_admins),
admin_visitors as (
  select distinct e.visitor_id from public.analytics_events e join admins a on a.user_id = e.user_id
),
ev as materialized (
  select e.* from public.analytics_events e, params p
  where e.created_at >= p.tp
    and (e.user_id is null or e.user_id not in (select user_id from admins))
    and e.visitor_id not in (select visitor_id from admin_visitors)
),
cur as materialized (select ev.* from ev, params p where ev.created_at >= p.t0),
prev as (select ev.* from ev, params p where ev.created_at < p.t0),
app as materialized (select * from cur where source = 'app'),
users as (
  select u.* from auth.users u where u.id not in (select user_id from admins)
),
wd as (
  select w.* from public.writing_days w, params p
  where w.day >= p.dp and w.user_id not in (select user_id from admins)
),
docs as (
  select d.* from public.documents d
  where d.user_id not in (select user_id from admins) and coalesce(d.settings ->> 'pristine', 'false') <> 'true'
),
-- one row per visitor with their most used value, so a person counts once in each breakdown
vis as (
  select visitor_id,
    mode() within group (order by platform) as platform,
    mode() within group (order by device) as device,
    mode() within group (order by os) as os,
    mode() within group (order by browser) as browser,
    mode() within group (order by country) as country,
    mode() within group (order by locale) as locale,
    mode() within group (order by split_part(lang, '-', 1)) as lang,
    mode() within group (order by app_version) filter (where platform = 'desktop') as app_version,
    count(distinct session_id) as sessions
  from app group by visitor_id
),
first_ref as (
  select distinct on (session_id) coalesce(nullif(referrer, ''), '(direct)') as referrer
  from app order by session_id, created_at
),
kpi as (
  select
    (select count(distinct visitor_id) from cur where source = 'app') as visitors,
    (select count(distinct visitor_id) from prev where source = 'app') as visitors_prev,
    (select count(distinct session_id) from cur where source = 'app') as sessions,
    (select count(distinct session_id) from prev where source = 'app') as sessions_prev,
    (select count(*) from cur where name = 'page_view') as page_views,
    (select count(*) from prev where name = 'page_view') as page_views_prev,
    (select count(*) from (
       select user_id from cur where user_id is not null
       union select user_id from wd, params p where wd.day >= p.d0 and words > 0) a) as active_writers,
    (select count(*) from (
       select user_id from prev where user_id is not null
       union select user_id from wd, params p where wd.day < p.d0 and words > 0) a) as active_writers_prev,
    (select count(*) from users) as writers_total,
    (select count(*) from users, params p where created_at >= p.t0) as new_writers,
    (select count(*) from users, params p where created_at >= p.tp and created_at < p.t0) as new_writers_prev,
    (select coalesce(sum(words), 0) from wd, params p where wd.day >= p.d0) as words,
    (select coalesce(sum(words), 0) from wd, params p where wd.day < p.d0) as words_prev,
    (select count(*) from docs, params p where created_at >= p.t0) as works,
    (select count(*) from docs, params p where created_at >= p.tp and created_at < p.t0) as works_prev,
    (select coalesce(sum((props ->> 'seconds')::numeric), 0) from cur where name = 'engagement') as engaged_seconds,
    (select coalesce(sum((props ->> 'seconds')::numeric), 0) from prev where name = 'engagement') as engaged_seconds_prev,
    (select count(*) from vis where sessions > 1) as returning_visitors,
    (select count(distinct visitor_id) from public.analytics_events e
       where e.created_at > now() - interval '5 minutes' and e.source = 'app'
         and (e.user_id is null or e.user_id not in (select user_id from admins))
         and e.visitor_id not in (select visitor_id from admin_visitors)) as online_now
),
days as (
  select generate_series(p.d0, (now() at time zone 'Asia/Kolkata')::date, interval '1 day')::date as day from params p
),
daily as (
  select d.day,
    (select count(distinct visitor_id) from app where (created_at at time zone 'Asia/Kolkata')::date = d.day) as visitors,
    (select count(*) from cur where name = 'page_view' and (created_at at time zone 'Asia/Kolkata')::date = d.day) as page_views,
    (select count(*) from (
       select user_id from cur where user_id is not null and (created_at at time zone 'Asia/Kolkata')::date = d.day
       union select user_id from wd where wd.day = d.day and words > 0) a) as active_writers,
    (select count(*) from users where (created_at at time zone 'Asia/Kolkata')::date = d.day) as signups,
    (select coalesce(sum(words), 0) from wd where wd.day = d.day) as words
  from days d
),
hours as (
  select extract(isodow from created_at at time zone 'Asia/Kolkata')::int as dow,
         extract(hour from created_at at time zone 'Asia/Kolkata')::int as hour,
         count(*) as n
  from cur where name <> 'engagement' group by 1, 2
),
breakdown as (
  select dim, jsonb_agg(jsonb_build_object('key', key, 'n', n) order by n desc, key) as rows
  from (
    select 'platform' as dim, coalesce(platform, 'unknown') as key, count(*) as n from vis group by 2
    union all select 'device', coalesce(device, 'unknown'), count(*) from vis group by 2
    union all select 'os', coalesce(os, 'unknown'), count(*) from vis group by 2
    union all select 'browser', coalesce(browser, 'unknown'), count(*) from vis group by 2
    union all select 'country', coalesce(country, '??'), count(*) from vis group by 2
    union all select 'locale', coalesce(locale, 'unknown'), count(*) from vis group by 2
    union all select 'lang', coalesce(lang, 'unknown'), count(*) from vis group by 2
    union all select 'app_version', app_version, count(*) from vis where app_version is not null group by 2
    union all select 'referrer', referrer, count(*) from first_ref group by 2
  ) b group by dim
),
pages as (
  select path, count(*) as views, count(distinct visitor_id) as visitors
  from cur where name = 'page_view' and path is not null group by path order by views desc limit 25
),
clicks as (
  select label, count(*) as n, count(distinct visitor_id) as visitors, mode() within group (order by path) as path
  from cur where name = 'click' and label is not null group by label order by n desc limit 40
),
features as (
  select name, coalesce(label, '') as label, count(*) as n, count(distinct coalesce(user_id::text, visitor_id)) as people
  from cur where name not in ('page_view', 'click', 'engagement') group by 1, 2 order by n desc limit 40
),
kinds as (
  select kind, count(*) as works, count(distinct user_id) as writers, coalesce(sum(word_count), 0) as words
  from docs group by kind order by works desc
),
providers as (
  select coalesce(raw_app_meta_data ->> 'provider', 'email') as key, count(*) as n from users group by 1 order by n desc
),
funnel as (
  select
    (select visitors from kpi) as visitors,
    (select new_writers from kpi) as signed_up,
    (select count(distinct d.user_id) from docs d join users u on u.id = d.user_id, params p where u.created_at >= p.t0) as started_a_work,
    (select count(distinct w.user_id) from wd w join users u on u.id = w.user_id, params p where u.created_at >= p.t0 and w.words > 0) as wrote
)
select jsonb_build_object(
  'days', p_days,
  'generated_at', now(),
  'kpi', (select to_jsonb(kpi) from kpi),
  'daily', (select coalesce(jsonb_agg(to_jsonb(daily) order by day), '[]'::jsonb) from daily),
  'hours', (select coalesce(jsonb_agg(to_jsonb(hours)), '[]'::jsonb) from hours),
  'breakdown', (select coalesce(jsonb_object_agg(dim, rows), '{}'::jsonb) from breakdown),
  'pages', (select coalesce(jsonb_agg(to_jsonb(pages)), '[]'::jsonb) from pages),
  'clicks', (select coalesce(jsonb_agg(to_jsonb(clicks)), '[]'::jsonb) from clicks),
  'features', (select coalesce(jsonb_agg(to_jsonb(features)), '[]'::jsonb) from features),
  'kinds', (select coalesce(jsonb_agg(to_jsonb(kinds)), '[]'::jsonb) from kinds),
  'providers', (select coalesce(jsonb_agg(to_jsonb(providers)), '[]'::jsonb) from providers),
  'funnel', (select to_jsonb(funnel) from funnel)
);
$$;

-- The user list: account details and usage counts. Works are counted, never listed.
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

-- One person's activity: 90 days of activity and words, devices, and their latest events.
create or replace function public.admin_user_activity(p_user uuid, p_limit integer default 200)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
with
days as (
  select generate_series((now() at time zone 'Asia/Kolkata')::date - 89, (now() at time zone 'Asia/Kolkata')::date, interval '1 day')::date as day
),
mine as (select * from public.analytics_events where user_id = p_user),
-- events sent from the same devices before signing in belong to the same person
vids as (select distinct visitor_id from mine where source = 'app'),
all_ev as (
  select * from mine
  union all
  select e.* from public.analytics_events e where e.user_id is null and e.visitor_id in (select visitor_id from vids)
)
select jsonb_build_object(
  'daily', (
    select jsonb_agg(jsonb_build_object(
      'day', d.day,
      'events', (select count(*) from all_ev e where (e.created_at at time zone 'Asia/Kolkata')::date = d.day and e.name <> 'engagement'),
      'words', coalesce((select w.words from public.writing_days w where w.user_id = p_user and w.day = d.day), 0)
    ) order by d.day) from days d
  ),
  'devices', (
    select coalesce(jsonb_agg(to_jsonb(x) order by x.last_seen desc), '[]'::jsonb) from (
      select platform, device, os, browser, country, app_version, count(distinct session_id) as sessions, max(created_at) as last_seen
      from all_ev where source = 'app' group by 1, 2, 3, 4, 5, 6
    ) x
  ),
  'events', (
    select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc), '[]'::jsonb) from (
      select created_at, name, path, label, props, platform, device, os, browser, country, session_id, (user_id is null) as before_sign_in
      from all_ev where name <> 'engagement' order by created_at desc limit greatest(1, least(p_limit, 1000))
    ) x
  )
);
$$;

revoke all on function public.admin_dashboard(integer, boolean) from public, anon, authenticated;
revoke all on function public.admin_users(boolean) from public, anon, authenticated;
revoke all on function public.admin_user_activity(uuid, integer) from public, anon, authenticated;
grant execute on function public.admin_dashboard(integer, boolean) to service_role;
grant execute on function public.admin_users(boolean) to service_role;
grant execute on function public.admin_user_activity(uuid, integer) to service_role;
