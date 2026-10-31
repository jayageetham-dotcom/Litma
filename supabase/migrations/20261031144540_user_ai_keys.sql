-- Each writer's own AI provider keys, AES-GCM encrypted by the litma-ai Edge Function.
-- No RLS policies on purpose: browsers can't read or write this table at all;
-- only the Edge Function (service role) touches it, and it never returns the key.
create table if not exists public.ai_keys (
  user_id uuid not null references auth.users on delete cascade,
  provider text not null check (provider in ('anthropic','openai','gemini')),
  ciphertext text not null,
  iv text not null,
  last4 text not null,
  model text,
  updated_at timestamptz not null default now(),
  primary key (user_id, provider)
);
alter table public.ai_keys enable row level security;
revoke all on public.ai_keys from anon, authenticated;
