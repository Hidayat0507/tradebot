-- Apply with local Supabase first. Never run this file automatically on startup.
begin;

create table if not exists public.bots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  exchange text not null,
  pair text not null,
  max_position_size numeric not null,
  stoploss_percentage numeric,
  enabled boolean not null default false,
  api_key text not null default '',
  api_secret text not null default '',
  password text,
  webhook_secret text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.trades (
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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  bot_id uuid not null references public.bots(id) on delete cascade,
  timestamp timestamptz not null default now(),
  type text not null check (type in ('info', 'warning', 'error', 'success')),
  message text not null,
  details jsonb,
  created_at timestamptz not null default now()
);

alter table public.bots enable row level security;
alter table public.trades enable row level security;
alter table public.logs enable row level security;

-- Permissive policies combine with OR: remove old policies before replacing them.
do $$
declare p record;
begin
  for p in select tablename, policyname from pg_policies
    where schemaname = 'public' and tablename in ('bots', 'trades', 'logs')
  loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end;
$$;

create policy bots_owner on public.bots for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
create policy trades_owner on public.trades for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
create policy logs_owner on public.logs for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Table-level grants override column restrictions, so revoke both kinds first.
revoke all on public.bots, public.trades, public.logs from public, anon, authenticated;
do $$
declare c record;
begin
  for c in select table_name, column_name from information_schema.columns
    where table_schema = 'public' and table_name in ('bots', 'trades', 'logs')
  loop
    execute format(
      'revoke all (%I) on public.%I from public, anon, authenticated',
      c.column_name, c.table_name);
  end loop;
end;
$$;

-- Owner reads remain supported, including credentials, for existing bot screens.
-- This migration restricts credential writes, not credential reads.
grant select, delete on public.bots to authenticated;
-- Explicit allowlist: new columns do not become client-writable automatically.
grant insert (id, user_id, name, exchange, pair, max_position_size,
  stoploss_percentage, enabled, created_at, updated_at)
  on public.bots to authenticated;
grant update (name, exchange, pair, max_position_size, stoploss_percentage,
  enabled, updated_at) on public.bots to authenticated;
grant select, insert, update, delete on public.trades, public.logs to authenticated;
grant all on public.bots, public.trades, public.logs to service_role;

commit;
