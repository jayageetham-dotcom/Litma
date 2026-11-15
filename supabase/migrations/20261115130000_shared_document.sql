-- Shared works (/read/?s=<share id>) are read through shared_document(), not the table.
--
-- The policy "public documents readable" let every signed-in writer read every shared work straight
-- from `documents`, so a listing without `user_id = me` (the desk in the web, desktop and phone apps
-- until 0.7.27) showed other writers' shared works as the writer's own, and actions on them failed
-- (Nov 2026: the App Review account's desk listed the owner's shared works). The apps now filter by
-- user_id, but builds already in the stores don't, so signed-in writers lose the direct read here and
-- the reader asks this function instead. Visitors who aren't signed in keep the direct read, so
-- links opened by older copies of the website keep working.

create or replace function public.shared_document(p_share text)
returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', d.id, 'title', d.title, 'kind', d.kind, 'content', d.content, 'settings', d.settings,
    'word_count', d.word_count, 'is_public', d.is_public, 'share_id', d.share_id, 'archived', d.archived,
    'created_at', d.created_at, 'updated_at', d.updated_at
  )
  from public.documents d
  where p_share is not null and d.share_id = p_share and d.is_public and not d.archived
  limit 1;
$$;
revoke execute on function public.shared_document(text) from public;
grant execute on function public.shared_document(text) to anon, authenticated;

drop policy if exists "public documents readable" on public.documents;
create policy "public documents readable" on public.documents for select to anon
  using (is_public = true and share_id is not null);
