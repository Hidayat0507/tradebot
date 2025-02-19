-- Create exchange_config table
CREATE TABLE IF NOT EXISTS public.exchange_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    exchange TEXT NOT NULL CHECK (exchange IN ('binance', 'coinbase', 'kraken')),
    api_key TEXT NOT NULL,
    api_secret TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Create trades table
CREATE TABLE IF NOT EXISTS public.trades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    external_id TEXT NOT NULL,
    bot_id TEXT NOT NULL,
    symbol TEXT NOT NULL,
    side TEXT NOT NULL CHECK (side IN ('buy', 'sell')),
    status TEXT NOT NULL CHECK (status IN ('pending', 'filled', 'cancelled', 'failed')),
    size NUMERIC NOT NULL,
    price NUMERIC,
    pnl NUMERIC,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.exchange_config ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own exchange config"
    ON public.exchange_config FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own exchange config"
    ON public.exchange_config FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own exchange config"
    ON public.exchange_config FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own exchange config"
    ON public.exchange_config FOR DELETE
    USING (auth.uid() = user_id);

-- Create RLS policies
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;

-- Create policies for trades
CREATE POLICY "Users can view their own trades"
    ON public.trades FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own trades"
    ON public.trades FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own trades"
    ON public.trades FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Create functions
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON public.exchange_config
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON public.trades
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();
