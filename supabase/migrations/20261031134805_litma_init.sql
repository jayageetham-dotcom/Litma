-- Litma — initial schema (profiles, documents, versions, AI suggestions, stats, MCP tokens, avatars)

create extension if not exists pgcrypto;

-- ── Profiles ────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text,
  pen_name text,
  username text unique check (username ~ '^[a-z0-9_]{3,30}$'),
  bio text check (char_length(bio) <= 600),
  location text,
  website text,
  avatar_url text,
  daily_goal int not null default 500 check (daily_goal between 0 and 100000),
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Trigger function: creates a profile row for each new auth user.
-- SECURITY DEFINER is required to write public.profiles from the auth schema trigger;
-- it is not callable through the API (execute revoked below).
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)))
  on conflict do nothing;
  return new;
end $$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ── Documents ───────────────────────────────────────────────────────────
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  title text not null default 'പേരില്ലാത്ത രചന',
  kind text not null default 'blank'
    check (kind in ('novel','story','poem','screenplay','feature','essay','drama','lyrics','diary','blank')),
  content jsonb not null default '{"type":"doc","content":[{"type":"paragraph"}]}'::jsonb,
  plain_text text not null default '',
  settings jsonb not null default '{}'::jsonb,
  word_count int not null default 0,
  is_public boolean not null default false,
  share_id text unique,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists documents_user_updated on public.documents (user_id, updated_at desc);

drop trigger if exists documents_touch on public.documents;
create trigger documents_touch before update on public.documents
  for each row execute function public.touch_updated_at();

-- ── Version history ─────────────────────────────────────────────────────
create table if not exists public.document_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents on delete cascade,
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  label text,
  content jsonb not null,
  word_count int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists versions_doc on public.document_versions (document_id, created_at desc);
create index if not exists versions_user on public.document_versions (user_id);

-- ── AI suggestions inbox (written by MCP clients: Claude, ChatGPT, Bob…) ──
create table if not exists public.suggestions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  source text not null default 'assistant',
  kind text not null default 'insert' check (kind in ('insert','replace','comment')),
  content text not null,
  target_text text,
  note text,
  status text not null default 'pending' check (status in ('pending','accepted','dismissed')),
  created_at timestamptz not null default now()
);
create index if not exists suggestions_doc on public.suggestions (document_id, created_at desc);
create index if not exists suggestions_user on public.suggestions (user_id);

-- ── Writing stats ───────────────────────────────────────────────────────
create table if not exists public.writing_days (
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  day date not null default current_date,
  words int not null default 0,
  primary key (user_id, day)
);

-- ── MCP access tokens (only a SHA-256 hash is stored) ───────────────────
create table if not exists public.mcp_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  name text not null,
  token_hash text not null unique,
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists mcp_tokens_user on public.mcp_tokens (user_id);

-- ── Grants + Row Level Security ─────────────────────────────────────────
grant select, insert, update, delete on public.profiles, public.documents, public.document_versions,
  public.suggestions, public.writing_days, public.mcp_tokens to authenticated;
grant select on public.documents to anon;

alter table public.profiles enable row level security;
alter table public.documents enable row level security;
alter table public.document_versions enable row level security;
alter table public.suggestions enable row level security;
alter table public.writing_days enable row level security;
alter table public.mcp_tokens enable row level security;

drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles for all to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

drop policy if exists "own documents" on public.documents;
create policy "own documents" on public.documents for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "public documents readable" on public.documents;
create policy "public documents readable" on public.documents for select to anon, authenticated
  using (is_public = true and share_id is not null);

drop policy if exists "own versions" on public.document_versions;
create policy "own versions" on public.document_versions for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "own suggestions" on public.suggestions;
create policy "own suggestions" on public.suggestions for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "own writing days" on public.writing_days;
create policy "own writing days" on public.writing_days for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "own tokens" on public.mcp_tokens;
create policy "own tokens" on public.mcp_tokens for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Add words written today (security invoker: RLS applies)
create or replace function public.add_words_today(n int) returns void
language sql security invoker set search_path = '' as $$
  insert into public.writing_days (user_id, day, words) values ((select auth.uid()), current_date, greatest(n, 0))
  on conflict (user_id, day) do update set words = public.writing_days.words + greatest(excluded.words, 0);
$$;
revoke execute on function public.add_words_today(int) from public, anon;
grant execute on function public.add_words_today(int) to authenticated;

-- Realtime: AI suggestions reach the open editor instantly
do $$ begin
  alter publication supabase_realtime add table public.suggestions;
exception when others then null; end $$;

-- ── Storage: profile pictures ───────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/png','image/jpeg','image/webp','image/gif'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Files live at avatars/<user id>/<file>. Owners can read/write their folder (upsert needs all three).
drop policy if exists "avatar read own" on storage.objects;
create policy "avatar read own" on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "avatar insert own" on storage.objects;
create policy "avatar insert own" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "avatar update own" on storage.objects;
create policy "avatar update own" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "avatar delete own" on storage.objects;
create policy "avatar delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
