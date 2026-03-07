-- Migration: Add images to venues table
-- Run this in your Supabase SQL Editor

ALTER TABLE public.venues
    ADD COLUMN IF NOT EXISTS images text[] DEFAULT '{}'::text[];

-- Add comment for documentation
COMMENT ON COLUMN public.venues.images IS 'List of public URLs for venue images';

-- 1. Create the 'venues' bucket (if doesn't exist)
-- This might require superuser permissions if run via SQL Editor
INSERT INTO storage.buckets (id, name, public)
VALUES ('venues', 'venues', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Set up RLS for the bucket (allow public read, authenticated upload)
CREATE POLICY "Public Read Access" ON storage.objects FOR SELECT USING (bucket_id = 'venues');
CREATE POLICY "Authenticated Upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'venues' AND auth.role() = 'authenticated');

-- Note: If the SQL above fails for storage, create it manually in the 
-- Supabase Dashboard -> Storage -> New Bucket (name it 'venues' and make it Public).
