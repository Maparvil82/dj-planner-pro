-- Add artist_name column to users_profile table
ALTER TABLE public.users_profile ADD COLUMN IF NOT EXISTS artist_name text;
