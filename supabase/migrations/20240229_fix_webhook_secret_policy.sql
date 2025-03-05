-- First grant all necessary permissions
GRANT ALL ON public.bots TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can update their own bots" ON public.bots;
DROP POLICY IF EXISTS "Users can view their own bots" ON public.bots;

-- Create SELECT policy
CREATE POLICY "Users can view their own bots"
ON public.bots
FOR SELECT
USING (auth.uid() = user_id);

-- Create UPDATE policy
CREATE POLICY "Users can update their own bots"
ON public.bots
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Ensure authenticated users have proper permissions
GRANT UPDATE(webhook_secret) ON public.bots TO authenticated; 