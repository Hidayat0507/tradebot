-- Dashboard status: last signal sent by the paper scheduler. Server-owned (no user grants).
alter table public.bot_strategies
  add column if not exists last_signal_at timestamptz,
  add column if not exists last_signal text check (last_signal is null or char_length(last_signal) <= 100);
