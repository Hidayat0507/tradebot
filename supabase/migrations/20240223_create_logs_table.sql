create table if not exists public.logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  bot_id text references public.bots(id) on delete set null,
  type text not null check (type in ('info', 'warning', 'error', 'success')),
  message text not null,
  details jsonb,
  timestamp timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Create indexes for better query performance
create index if not exists logs_user_id_idx on public.logs(user_id);
create index if not exists logs_bot_id_idx on public.logs(bot_id);
create index if not exists logs_timestamp_idx on public.logs(timestamp);

-- Add RLS policies
alter table public.logs enable row level security;

create policy "Users can view their own logs"
  on public.logs for select
  using (auth.uid() = user_id);

create policy "Users can create their own logs"
  on public.logs for insert
  with check (auth.uid() = user_id);
