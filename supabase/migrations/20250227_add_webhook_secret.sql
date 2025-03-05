-- Add webhook_secret column to bots table
ALTER TABLE public.bots 
ADD COLUMN webhook_secret TEXT;

-- Set default webhook secrets for existing bots
UPDATE public.bots 
SET webhook_secret = encode(gen_random_bytes(32), 'hex')
WHERE webhook_secret IS NULL;

-- Make webhook_secret required
ALTER TABLE public.bots
ALTER COLUMN webhook_secret SET NOT NULL;

-- Drop existing update policy if it exists
DROP POLICY IF EXISTS "Users can update their own bots" ON public.bots;

-- Create simple update policy
CREATE POLICY "Users can update their own bots"
ON public.bots
FOR UPDATE
USING (auth.uid() = user_id);

-- Grant update permission
GRANT UPDATE ON public.bots TO authenticated; 