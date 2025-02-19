-- Create functions
CREATE OR REPLACE FUNCTION public.generate_short_id(size INT DEFAULT 6)
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  result TEXT := '';
  i INT := 0;
  rand FLOAT;
BEGIN
  FOR i IN 1..size LOOP
    rand := random();
    result := result || substr(chars, (rand * length(chars) + 1)::INTEGER, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql VOLATILE;

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create exchange_config table
CREATE TABLE IF NOT EXISTS public.exchange_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
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
    user_id UUID NOT NULL,
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

-- Create bots table
CREATE TABLE IF NOT EXISTS public.bots (
    id TEXT PRIMARY KEY DEFAULT public.generate_short_id(8),
    user_id UUID NOT NULL,
    name TEXT NOT NULL,
    pair TEXT NOT NULL,
    secret TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('active', 'paused', 'stopped')),
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, name)
);

-- Enable RLS
ALTER TABLE public.exchange_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bots ENABLE ROW LEVEL SECURITY;

-- Create policies for exchange_config
CREATE POLICY "Enable read access for users to their own exchange configs"
    ON public.exchange_config 
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Enable insert access for authenticated users to their own exchange configs"
    ON public.exchange_config 
    FOR INSERT
    WITH CHECK (
        auth.role() = 'authenticated' AND 
        auth.uid() = user_id
    );

CREATE POLICY "Enable update access for users to their own exchange configs"
    ON public.exchange_config 
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Enable delete access for users to their own exchange configs"
    ON public.exchange_config 
    FOR DELETE
    USING (auth.uid() = user_id);

-- Create policies for bots
CREATE POLICY "Enable read access for users to their own bots"
    ON public.bots
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Enable insert access for authenticated users to their own bots"
    ON public.bots
    FOR INSERT
    WITH CHECK (
        auth.role() = 'authenticated' AND 
        auth.uid() = user_id
    );

CREATE POLICY "Enable update access for users to their own bots"
    ON public.bots
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Enable delete access for users to their own bots"
    ON public.bots
    FOR DELETE
    USING (auth.uid() = user_id);

-- Create policies for trades
CREATE POLICY "Users can view their own trades"
    ON public.trades
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert and update their own trades"
    ON public.trades
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Grant access to authenticated users
GRANT ALL ON public.exchange_config TO authenticated;
GRANT ALL ON public.trades TO authenticated;
GRANT ALL ON public.bots TO authenticated;

-- Create triggers
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON public.exchange_config
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON public.trades
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON public.bots
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();
