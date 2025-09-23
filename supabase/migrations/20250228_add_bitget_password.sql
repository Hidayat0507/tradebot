-- Add Bitget API passphrase support to bots table
-- Safe to run multiple times

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'bots'
      AND column_name = 'password'
  ) THEN
    ALTER TABLE public.bots
    ADD COLUMN password VARCHAR(255);
  END IF;
END $$;







