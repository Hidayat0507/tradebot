-- Ensure trades.external_id is unique to prevent duplicate inserts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'public' 
      AND indexname = 'trades_external_id_unique'
  ) THEN
    CREATE UNIQUE INDEX trades_external_id_unique ON public.trades(external_id);
  END IF;
END $$;

-- Backfill bots.pair to include a slash if missing for common quote assets
UPDATE public.bots
SET pair =
  CASE
    WHEN pair NOT LIKE '%/%' AND pair LIKE '%USDT' THEN substr(pair, 1, length(pair) - 4) || '/USDT'
    WHEN pair NOT LIKE '%/%' AND pair LIKE '%USDC' THEN substr(pair, 1, length(pair) - 4) || '/USDC'
    ELSE pair
  END;







