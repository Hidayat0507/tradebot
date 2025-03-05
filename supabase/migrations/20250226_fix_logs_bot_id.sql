-- First drop the existing foreign key constraint
ALTER TABLE public.logs DROP CONSTRAINT IF EXISTS logs_bot_id_fkey;

-- Change bot_id column type to TEXT to match bots.id
ALTER TABLE public.logs 
    ALTER COLUMN bot_id TYPE TEXT USING bot_id::TEXT;

-- Recreate the foreign key constraint with the correct type
ALTER TABLE public.logs
    ADD CONSTRAINT logs_bot_id_fkey
    FOREIGN KEY (bot_id) REFERENCES public.bots(id)
    ON DELETE SET NULL;
