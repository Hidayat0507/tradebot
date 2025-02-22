-- Create subscription plans table
create table if not exists public.subscription_plans (
    id text primary key,
    name text not null,
    description text,
    price_id text not null,  -- Stripe price ID
    amount numeric not null,
    currency text not null default 'usd',
    interval text not null check (interval in ('month', 'year')),
    features jsonb not null default '[]'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- Create subscriptions table
create table if not exists public.subscriptions (
    id text primary key,  -- Stripe subscription ID
    user_id uuid not null references auth.users(id) on delete cascade,
    plan_id text not null references subscription_plans(id),
    status text not null check (status in ('active', 'canceled', 'incomplete', 'incomplete_expired', 'past_due', 'trialing', 'unpaid')),
    current_period_end timestamptz,
    cancel_at_period_end boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- Add RLS policies
alter table public.subscription_plans enable row level security;
alter table public.subscriptions enable row level security;

-- Everyone can view plans
create policy "Anyone can view subscription plans"
    on subscription_plans for select
    using (true);

-- Users can view their own subscriptions
create policy "Users can view their own subscriptions"
    on subscriptions for select
    using (auth.uid() = user_id);

-- Insert some default plans
insert into subscription_plans (id, name, description, price_id, amount, interval, features) values
    ('basic', 'Basic Plan', 'Perfect for getting started', 'price_basic', 9.99, 'month', '["1 Trading Bot", "Basic Support", "Standard Features"]'::jsonb),
    ('pro', 'Pro Plan', 'For serious traders', 'price_pro', 29.99, 'month', '["5 Trading Bots", "Priority Support", "Advanced Features", "Real-time Alerts"]'::jsonb),
    ('enterprise', 'Enterprise Plan', 'Full power and customization', 'price_enterprise', 99.99, 'month', '["Unlimited Bots", "24/7 Support", "Custom Features", "API Access", "Team Management"]'::jsonb)
on conflict (id) do nothing;
