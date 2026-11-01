-- Allow 'testnet' bots: real orders routed to the exchange sandbox (mock funds).
alter table public.bots drop constraint if exists bots_mode_check;
alter table public.bots add constraint bots_mode_check check (mode in ('live', 'paper', 'testnet'));
