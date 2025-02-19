-- Add enabled column to bots table
ALTER TABLE public.bots ADD COLUMN enabled BOOLEAN NOT NULL DEFAULT false;

-- Update existing bots to be enabled if status is 'active'
UPDATE public.bots SET enabled = (status = 'active');
