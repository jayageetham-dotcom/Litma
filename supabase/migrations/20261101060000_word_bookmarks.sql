-- Words a writer saves from the dictionary, with a short meaning, to reuse while writing.
create table if not exists public.word_bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  word text not null check (char_length(word) between 1 and 80),
  lang text not null default 'ml' check (lang in ('en','ml')),
  meaning text check (char_length(meaning) <= 600),
  synonyms text[] not null default '{}',
  note text check (char_length(note) <= 1000),
  created_at timestamptz not null default now(),
  unique (user_id, word)
);
alter table public.word_bookmarks enable row level security;

create policy "own bookmarks: read" on public.word_bookmarks for select to authenticated using ((select auth.uid()) = user_id);
create policy "own bookmarks: add" on public.word_bookmarks for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own bookmarks: edit" on public.word_bookmarks for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own bookmarks: remove" on public.word_bookmarks for delete to authenticated using ((select auth.uid()) = user_id);

create index if not exists word_bookmarks_user_created on public.word_bookmarks (user_id, created_at desc);
