create table if not exists public.user_subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text,
  plan text not null default 'free',
  status text not null default 'inactive',
  max_bots integer,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  metadata jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.user_subscriptions enable row level security;

create policy "Users can view own subscription"
  on public.user_subscriptions
  for select
  using (auth.uid() = user_id);

create or replace function public.set_user_subscriptions_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$ language plpgsql;

create trigger user_subscriptions_updated_at
  before update on public.user_subscriptions
  for each row
  execute function public.set_user_subscriptions_updated_at();
