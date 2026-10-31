-- LOCAL TEST ONLY (PGlite). Emulates the parts of Supabase our migrations depend on, plus the
-- assumed base tables that exist in the hosted project but are not in supabase/migrations.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
grant usage on schema auth to anon, authenticated, service_role;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant usage on schema public to anon, authenticated, service_role;
-- Supabase default: API roles get table privileges on new public tables; RLS does the filtering.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;

create table public.bots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  exchange text not null,
  pair text not null,
  max_position_size numeric not null default 1,
  enabled boolean not null default false,
  api_key text not null default '',
  api_secret text not null default '',
  webhook_secret text not null default '',
  created_at timestamptz not null default now()
);
alter table public.bots enable row level security;
create policy bots_own on public.bots for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create table public.trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  external_id text not null,
  bot_id uuid not null references public.bots(id) on delete cascade,
  symbol text not null,
  side text not null,
  status text not null,
  size numeric not null,
  price numeric,
  pnl numeric,
  created_at timestamptz not null default now()
);
alter table public.trades enable row level security;
create policy trades_own on public.trades for select to authenticated using (user_id = auth.uid());
