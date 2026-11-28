-- The writing type ശൂന്യം is now കുറിപ്പ് (Note). New notes are called "പുതിയ കുറിപ്പ്"; works still
-- carrying the old default title get the new one (owner's request, Nov 2026). Only that exact title
-- on notes is changed. The touch trigger is paused so the desks keep their order.
alter table public.documents disable trigger documents_touch;

update public.documents
set title = 'പുതിയ കുറിപ്പ്'
where kind = 'blank' and title = 'പുതിയ ശൂന്യം';

alter table public.documents enable trigger documents_touch;
