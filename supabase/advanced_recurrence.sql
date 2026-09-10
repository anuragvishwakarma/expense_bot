-- Add cron_expression column to recurrences table
ALTER TABLE public.recurrences ADD COLUMN IF NOT EXISTS cron_expression TEXT NULL;