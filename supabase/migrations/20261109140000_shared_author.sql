-- The writer's name on a shared work (/read/?s=<share id>).
-- Profiles are private (each writer reads only their own), and shared links are opened by visitors who
-- are not signed in, so the reader asks this function instead. It answers only for a work that is
-- shared right now, and gives only what a printed byline shows: the pen name (or the profile name)
-- and the chosen avatar. Never the email, location, bio or anything else.

create or replace function public.shared_author(p_share text)
returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'name', coalesce(nullif(btrim(p.pen_name), ''), nullif(btrim(p.display_name), '')),
    'avatar', p.preferences ->> 'avatar',
    'tint', p.preferences ->> 'avatarTint'
  )
  from public.documents d
  join public.profiles p on p.id = d.user_id
  where d.share_id = p_share and d.is_public and not d.archived
  limit 1;
$$;

revoke execute on function public.shared_author(text) from public;
grant execute on function public.shared_author(text) to anon, authenticated;
