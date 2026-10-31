-- Existing bots retain live behavior; paper bots never initialize an exchange client.
ALTER TABLE public.bots
  ADD COLUMN mode text NOT NULL DEFAULT 'live'
  CHECK (mode IN ('live', 'paper'));
