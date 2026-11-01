-- Base tables previously existed only in the hosted project.
-- IF NOT EXISTS preserves existing tables; owner grants/policies follow in owner_rls.
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

alter table public.bots enable row level security;
alter table public.trades enable row level security;
