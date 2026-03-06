-- Migration: Add sound_quality and experience_rating to venues table
-- Run this in your Supabase SQL Editor

ALTER TABLE venues
    ADD COLUMN IF NOT EXISTS sound_quality smallint CHECK (sound_quality >= 1 AND sound_quality <= 5),
    ADD COLUMN IF NOT EXISTS experience_rating smallint CHECK (experience_rating >= 1 AND experience_rating <= 5);

-- Optional: add comments for documentation
COMMENT ON COLUMN venues.sound_quality IS 'Sound system quality rating from 1 (poor) to 5 (excellent)';
COMMENT ON COLUMN venues.experience_rating IS 'Overall experience rating from 1 (poor) to 5 (excellent)';
