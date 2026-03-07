-- Migration: Add capacity and equipment to venues table
-- Run this in your Supabase SQL Editor

ALTER TABLE public.venues
    ADD COLUMN IF NOT EXISTS capacity integer,
    ADD COLUMN IF NOT EXISTS equipment JSONB DEFAULT '[]'::jsonb;

-- If column already exists as text[] or text, you might need to drop and recreate or cast it.
-- For a clean start or migration:
-- ALTER TABLE public.venues DROP COLUMN IF EXISTS equipment;
-- ALTER TABLE public.venues ADD COLUMN equipment JSONB DEFAULT '[]'::jsonb;

-- Add comments for documentation
COMMENT ON COLUMN public.venues.capacity IS 'Maximum venue capacity (aforo)';
COMMENT ON COLUMN public.venues.equipment IS 'List of audio and DJ equipment available at the venue with quantities (e.g., [{"name": "Speaker", "quantity": 2}])';
