-- Durable replay claims. Only the server service role may write these rows.
create table public.signals (
  id bigint generated always as identity primary key,
  bot_id text not null references public.bots(id) on delete cascade,
  alert_id text not null check (length(alert_id) between 1 and 256),
  ts timestamptz not null,
  created_at timestamptz not null default now(),
  unique (bot_id, alert_id)
);
alter table public.signals enable row level security;
revoke all on public.signals from anon, authenticated;
grant all on public.signals to service_role;
grant usage, select on sequence public.signals_id_seq to service_role;
