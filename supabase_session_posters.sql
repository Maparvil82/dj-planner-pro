-- Migration: Add poster_url to sessions table
-- Run this in your Supabase SQL Editor

ALTER TABLE public.sessions
    ADD COLUMN IF NOT EXISTS poster_url text;

-- Add comment for documentation
COMMENT ON COLUMN public.sessions.poster_url IS 'Public URL of the event poster image';

-- 1. Create the 'sessions' bucket (if doesn't exist)
INSERT INTO storage.buckets (id, name, public)
VALUES ('sessions', 'sessions', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Set up RLS for the bucket (allow public read, authenticated upload/delete)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Public Read Access Sessions'
    ) THEN
        CREATE POLICY "Public Read Access Sessions" ON storage.objects FOR SELECT USING (bucket_id = 'sessions');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated Upload Sessions'
    ) THEN
        CREATE POLICY "Authenticated Upload Sessions" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'sessions' AND auth.role() = 'authenticated');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated Delete Sessions'
    ) THEN
        CREATE POLICY "Authenticated Delete Sessions" ON storage.objects FOR DELETE USING (bucket_id = 'sessions' AND auth.role() = 'authenticated');
    END IF;
END $$;
