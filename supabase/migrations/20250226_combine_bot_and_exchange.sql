-- First, drop foreign key constraints
ALTER TABLE IF EXISTS public.logs DROP CONSTRAINT IF EXISTS logs_bot_id_fkey;
ALTER TABLE IF EXISTS public.trades DROP CONSTRAINT IF EXISTS trades_bot_id_fkey;

-- Drop the existing tables
DROP TABLE IF EXISTS public.exchange_config;
DROP TABLE IF EXISTS public.bots;

-- Create the new combined bots table
CREATE TABLE public.bots (
    id TEXT PRIMARY KEY DEFAULT public.generate_short_id(8),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL,
    exchange TEXT NOT NULL,
    pair VARCHAR(20) NOT NULL,
    max_position_size DECIMAL(18,8) NOT NULL,
    stoploss_percentage DECIMAL(5,2),
    enabled BOOLEAN NOT NULL DEFAULT false,
    api_key VARCHAR(255) NOT NULL,
    api_secret VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT exchange_check CHECK (exchange IN ('binance', 'hyperliquid'))
);

-- Create an index on user_id for faster lookups
CREATE INDEX bots_user_id_idx ON public.bots(user_id);

-- Create a trigger to automatically update the updated_at timestamp
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON public.bots
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- Set up RLS (Row Level Security)
ALTER TABLE public.bots ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own bots"
    ON public.bots FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own bots"
    ON public.bots FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own bots"
    ON public.bots FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own bots"
    ON public.bots FOR DELETE
    USING (auth.uid() = user_id);

-- Grant access to authenticated users
GRANT ALL ON public.bots TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Recreate foreign key constraints
ALTER TABLE public.logs
    ADD CONSTRAINT logs_bot_id_fkey
    FOREIGN KEY (bot_id) REFERENCES public.bots(id)
    ON DELETE CASCADE;

ALTER TABLE public.trades
    ADD CONSTRAINT trades_bot_id_fkey
    FOREIGN KEY (bot_id) REFERENCES public.bots(id)
    ON DELETE CASCADE;
