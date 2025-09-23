-- Update bots.exchange CHECK constraint to drop Binance support

DO $$
BEGIN
  -- Drop existing constraint if it exists
  BEGIN
    ALTER TABLE public.bots DROP CONSTRAINT IF EXISTS exchange_check;
  EXCEPTION WHEN undefined_table THEN
    -- Table may not exist in some environments; ignore
    NULL;
  END;

  -- Recreate the constraint allowing only hyperliquid and bitget
  BEGIN
    ALTER TABLE public.bots
      ADD CONSTRAINT exchange_check CHECK (exchange IN ('hyperliquid', 'bitget'));
  EXCEPTION WHEN undefined_table THEN
    -- Table missing; nothing to do in this environment
    NULL;
  END;
END $$;







