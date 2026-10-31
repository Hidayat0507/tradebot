-- Existing bots retain live execution unless paper mode is explicitly selected.
alter table public.bots
  add column mode text not null default 'live'
  check (mode in ('live', 'paper'));
