-- Story World (characters, locations, props, plot cards, timeline, notes), books, and a media bucket.

create table if not exists public.story_items (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents on delete cascade,
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  kind text not null check (kind in ('character','location','item','beat','event','note')),
  name text not null default '',
  summary text not null default '',
  data jsonb not null default '{}'::jsonb,
  image_url text,
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists story_items_doc on public.story_items (document_id, kind, position);
create index if not exists story_items_user on public.story_items (user_id);
drop trigger if exists story_items_touch on public.story_items;
create trigger story_items_touch before update on public.story_items
  for each row execute function public.touch_updated_at();

create table if not exists public.books (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  title text not null default 'പുതിയ പുസ്തകം',
  subtitle text,
  author text,
  structure jsonb not null default '[]'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  cover jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists books_user_updated on public.books (user_id, updated_at desc);
drop trigger if exists books_touch on public.books;
create trigger books_touch before update on public.books
  for each row execute function public.touch_updated_at();

grant select, insert, update, delete on public.story_items, public.books to authenticated;
alter table public.story_items enable row level security;
alter table public.books enable row level security;

drop policy if exists "own story items" on public.story_items;
create policy "own story items" on public.story_items for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "own books" on public.books;
create policy "own books" on public.books for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Images for Story World cards and book covers: media/<user id>/<…>
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 8388608, array['image/png','image/jpeg','image/webp','image/gif'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "media read own" on storage.objects;
create policy "media read own" on storage.objects for select to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "media insert own" on storage.objects;
create policy "media insert own" on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "media update own" on storage.objects;
create policy "media update own" on storage.objects for update to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "media delete own" on storage.objects;
create policy "media delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid())::text);
