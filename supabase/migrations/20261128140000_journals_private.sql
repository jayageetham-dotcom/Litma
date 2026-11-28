-- Journals (kind 'diary') are private: they can never be shared by link (owner, 28 Nov 2026).
-- The web, desktop and phone apps hide every share entry for journals and the MCP server refuses;
-- this trigger is the rule underneath, so an older app or any other client can't share one either.
-- Existing journal shares are revoked. The touch trigger is paused so the desks keep their order.

create or replace function public.journals_stay_private()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.kind = 'diary' and (new.is_public or new.share_id is not null) then
    raise exception 'Journals can''t be shared by link.'
      using errcode = 'check_violation', hint = 'Export the journal as PDF or Word instead.';
  end if;
  return new;
end
$$;

revoke execute on function public.journals_stay_private() from public, anon, authenticated;

drop trigger if exists documents_journals_private on public.documents;
create trigger documents_journals_private
  before insert or update of kind, is_public, share_id on public.documents
  for each row execute function public.journals_stay_private();

alter table public.documents disable trigger documents_touch;

update public.documents
set is_public = false, share_id = null
where kind = 'diary' and (is_public or share_id is not null);

alter table public.documents enable trigger documents_touch;
