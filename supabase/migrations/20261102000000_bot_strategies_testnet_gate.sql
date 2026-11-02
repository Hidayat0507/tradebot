-- Written for review; apply only to local Supabase during development, never hosted here.
-- The strategy mode constraint remains paper-only. Routing is separately gated.
alter table public.bot_strategies
  add column allow_testnet boolean not null default false,
  add column max_orders_per_day integer not null default 5 check (max_orders_per_day between 1 and 50),
  add column kill_switch_tripped_at timestamptz;
grant insert (allow_testnet, max_orders_per_day), update (allow_testnet, max_orders_per_day)
  on public.bot_strategies to authenticated;

-- A reservation counts an attempted order, including failures, by UTC execution day.
-- Serialize competing cron workers on the strategy row; never release an ambiguous attempt.
create function public.claim_strategy_order(p_bot_id uuid, p_alert_id text, p_ts timestamptz)
returns text language plpgsql security invoker set search_path = '' as $$
declare
  s public.bot_strategies%rowtype;
  used integer;
begin
  select * into s from public.bot_strategies where bot_id = p_bot_id for update;
  if not found or not s.enabled or s.kill_switch_tripped_at is not null then return 'stopped'; end if;
  if exists (select 1 from public.signals where bot_id = p_bot_id and alert_id = p_alert_id) then return 'duplicate'; end if;
  select count(*) into used from public.signals
    where bot_id = p_bot_id and alert_id like 'pine:%'
      and created_at >= date_trunc('day', now() at time zone 'UTC') at time zone 'UTC';
  if used >= s.max_orders_per_day then
    update public.bot_strategies set kill_switch_tripped_at = now(), last_signal = 'stopped — daily cap reached' where bot_id = p_bot_id;
    return 'stopped';
  end if;
  insert into public.signals (bot_id, alert_id, ts) values (p_bot_id, p_alert_id, p_ts);
  if used + 1 >= s.max_orders_per_day then
    update public.bot_strategies set kill_switch_tripped_at = now(), last_signal = 'stopped — daily cap reached' where bot_id = p_bot_id;
  end if;
  return 'claimed';
end $$;
revoke all on function public.claim_strategy_order(uuid, text, timestamptz) from public, anon, authenticated;
grant execute on function public.claim_strategy_order(uuid, text, timestamptz) to service_role;

-- Explicit owner action through the authenticated API; service role only.
-- The cursor moves to now to prevent replay of candles accumulated while stopped.
-- Clearing never deletes reservations: today's daily budget still applies.
create function public.clear_strategy_kill_switch(p_bot_id uuid, p_user_id uuid)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  update public.bot_strategies set kill_switch_tripped_at = null, enabled = true,
    last_candle_time = now(), last_signal = null
    where bot_id = p_bot_id and user_id = p_user_id
      and exists (select 1 from public.bots b where b.id = p_bot_id and b.user_id = p_user_id
        and b.mode in ('paper', 'testnet') and (not allow_testnet or b.mode = 'testnet'));
  return found;
end $$;
revoke all on function public.clear_strategy_kill_switch(uuid, uuid) from public, anon, authenticated;
grant execute on function public.clear_strategy_kill_switch(uuid, uuid) to service_role;
