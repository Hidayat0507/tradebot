-- CONFIRM THE HOSTED public.bots.id TYPE BEFORE APPLYING.
-- 20261031000000_webhook_signals.sql declared signals.bot_id as text referencing bots.id.
-- If bots.id is uuid (as PR #8 shows) that FK cannot be created, so the table never got created.
-- This migration is idempotent and refuses to run if bots.id is not uuid.
do $$
declare
  bots_id_type text;
  signals_bot_id_type text;
begin
  select format_type(a.atttypid, a.atttypmod) into bots_id_type
  from pg_attribute a
  where a.attrelid = 'public.bots'::regclass and a.attname = 'id' and not a.attisdropped;

  if bots_id_type is distinct from 'uuid' then
    raise exception 'public.bots.id is %, expected uuid; signals fix not applied', bots_id_type;
  end if;

  if to_regclass('public.signals') is null then
    create table public.signals (
      id bigint generated always as identity primary key,
      bot_id uuid not null references public.bots(id) on delete cascade,
      alert_id text not null check (length(alert_id) between 1 and 256),
      ts timestamptz not null,
      created_at timestamptz not null default now(),
      unique (bot_id, alert_id)
    );
  else
    select format_type(a.atttypid, a.atttypmod) into signals_bot_id_type
    from pg_attribute a
    where a.attrelid = 'public.signals'::regclass and a.attname = 'bot_id' and not a.attisdropped;
    if signals_bot_id_type <> 'uuid' then
      alter table public.signals drop constraint if exists signals_bot_id_fkey;
      alter table public.signals alter column bot_id type uuid using bot_id::uuid;
      alter table public.signals add constraint signals_bot_id_fkey
        foreign key (bot_id) references public.bots(id) on delete cascade;
    end if;
  end if;
end $$;

-- Re-assert the access model from the original migration (service role only).
alter table public.signals enable row level security;
revoke all on public.signals from anon, authenticated;
grant all on public.signals to service_role;
grant usage, select on sequence public.signals_id_seq to service_role;
