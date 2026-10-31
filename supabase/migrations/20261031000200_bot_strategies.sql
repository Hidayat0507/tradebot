-- In-app strategy definitions (Pine → StrategyDefinition), one per bot.
-- Written only; apply via the normal migration process after review.
create table if not exists public.bot_strategies (
  id uuid primary key default gen_random_uuid(),
  bot_id uuid not null unique references public.bots(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Strategy' check (char_length(name) <= 100),
  pine_source text not null check (char_length(pine_source) <= 20000),
  definition jsonb not null check (jsonb_typeof(definition) = 'object' and pg_column_size(definition) <= 200000),
  converter text not null default 'parser' check (converter in ('parser', 'ai')),
  timeframe text not null default '1h' check (timeframe in ('1m', '5m', '15m', '1h', '4h', '1d')),
  -- Phase 2: in-app strategies may only run in paper mode.
  mode text not null default 'paper' check (mode = 'paper'),
  paper_quote_size numeric not null default 100 check (paper_quote_size > 0 and paper_quote_size <= 1000000),
  enabled boolean not null default false,
  last_candle_time timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bot_strategies_user_id_idx on public.bot_strategies(user_id);
create index if not exists bot_strategies_enabled_idx on public.bot_strategies(enabled) where enabled;

alter table public.bot_strategies enable row level security;
alter table public.bot_strategies force row level security;

create policy "bot_strategies_select_own" on public.bot_strategies
  for select to authenticated using (user_id = (select auth.uid()));

create policy "bot_strategies_insert_own" on public.bot_strategies
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.bots b where b.id = bot_id and b.user_id = (select auth.uid()))
  );

create policy "bot_strategies_update_own" on public.bot_strategies
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.bots b where b.id = bot_id and b.user_id = (select auth.uid()))
  );

create policy "bot_strategies_delete_own" on public.bot_strategies
  for delete to authenticated using (user_id = (select auth.uid()));

-- Column-level grants: a table-level UPDATE grant would override a column revoke, so revoke
-- table-level and grant only user-editable columns. mode, user_id, bot_id and the scheduler
-- cursor (last_candle_time) stay server-owned.
revoke all on public.bot_strategies from anon;
revoke insert, update on public.bot_strategies from authenticated;
grant select, delete on public.bot_strategies to authenticated;
grant insert (bot_id, user_id, name, pine_source, definition, converter, timeframe, paper_quote_size, enabled)
  on public.bot_strategies to authenticated;
grant update (name, pine_source, definition, converter, timeframe, paper_quote_size, enabled)
  on public.bot_strategies to authenticated;

create or replace function public.bot_strategies_touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists bot_strategies_touch_updated_at on public.bot_strategies;
create trigger bot_strategies_touch_updated_at
  before update on public.bot_strategies
  for each row execute function public.bot_strategies_touch_updated_at();
