-- Security hardening (Nov 2026 audit).
--
-- 1. Visitors who aren't signed in could list EVERY shared work straight from `documents` with the
--    public anon key (GET /rest/v1/documents?is_public=eq.true): title, full text, plain text, the
--    writer's user id, and works shared before they were moved to the trash. A shared link is meant
--    to open one work for someone who has its link, not to publish a list. Every current app reads
--    shared works through shared_document(share_id) (needs the exact link id, skips trashed works),
--    so the direct read is removed for visitors as it already was for signed-in writers.
drop policy if exists "public documents readable" on public.documents;

-- 2. The API roles never need TRUNCATE, TRIGGER or REFERENCES on Litma's tables (TRUNCATE skips
--    row level security). PostgREST can't send them today; this keeps it that way if that changes.
revoke truncate, trigger, references on all tables in schema public from anon, authenticated;
alter default privileges in schema public revoke truncate, trigger, references on tables from anon, authenticated;
