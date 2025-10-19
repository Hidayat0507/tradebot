-- Enable RLS on bots table if not already enabled
alter table public.bots enable row level security;

-- Policy: Users can view their own bots
create policy "Users can view own bots"
  on public.bots
  for select
  using (auth.uid() = user_id);

-- Policy: Users can insert their own bots
create policy "Users can insert own bots"
  on public.bots
  for insert
  with check (auth.uid() = user_id);

-- Policy: Users can update their own bots
create policy "Users can update own bots"
  on public.bots
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Policy: Users can delete their own bots
create policy "Users can delete own bots"
  on public.bots
  for delete
  using (auth.uid() = user_id);

-- Similarly, enable RLS on trades table
alter table public.trades enable row level security;

-- Policy: Users can view their own trades
create policy "Users can view own trades"
  on public.trades
  for select
  using (auth.uid() = user_id);

-- Policy: Users can insert their own trades (for webhook operations)
create policy "Users can insert own trades"
  on public.trades
  for insert
  with check (auth.uid() = user_id);

-- Policy: Users can update their own trades
create policy "Users can update own trades"
  on public.trades
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Similarly, enable RLS on logs table
alter table public.logs enable row level security;

-- Policy: Users can view their own logs
create policy "Users can view own logs"
  on public.logs
  for select
  using (auth.uid() = user_id);

-- Policy: Users can insert their own logs
create policy "Users can insert own logs"
  on public.logs
  for insert
  with check (auth.uid() = user_id);

