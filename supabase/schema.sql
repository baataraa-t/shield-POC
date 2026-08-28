-- Run this in the Supabase SQL editor (once).
-- The app uses the service role key, so RLS can stay on with no public policies.

create table if not exists public.users (
  email text primary key,
  password_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  session_id text,
  payload jsonb not null,
  received_at timestamptz not null default now()
);

create index if not exists webhook_deliveries_received_at_idx
  on public.webhook_deliveries (received_at desc);

create index if not exists webhook_deliveries_session_id_idx
  on public.webhook_deliveries (session_id);

alter table public.users enable row level security;
alter table public.webhook_deliveries enable row level security;
