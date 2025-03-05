-- Add webhook_secret column to bots table if it doesn't exist
ALTER TABLE public.bots 
ADD COLUMN IF NOT EXISTS webhook_secret TEXT;

-- Make sure webhook_secret is not null by setting a default value for existing rows
UPDATE public.bots 
SET webhook_secret = encode(gen_random_bytes(32), 'hex')
WHERE webhook_secret IS NULL;

ALTER TABLE public.bots
ALTER COLUMN webhook_secret SET NOT NULL;

-- Update RLS policies to include webhook_secret
DROP POLICY IF EXISTS "Users can update their own bots" ON public.bots;

CREATE POLICY "Users can update their own bots"
ON public.bots
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Grant necessary permissions
GRANT UPDATE(webhook_secret) ON public.bots TO authenticated;
