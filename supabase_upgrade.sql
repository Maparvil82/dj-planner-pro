/* --- NEW MIGRATIONS FOR COLLECTIVE SESSIONS --- */
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS is_collective boolean DEFAULT false;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS djs text[] DEFAULT '{}';

/* 
  We need to update the constraint on user_tags to allow 'dj' as a type.
  Since we can't easily ALTER a CHECK constraint, we must DROP it and recreate it.
  
  First, find the name of the constraint. Supabase usually names it user_tags_type_check.
  If it fails because the name is different, you might need to find it manually in the dashboard.
*/
ALTER TABLE public.user_tags DROP CONSTRAINT IF EXISTS user_tags_type_check;
ALTER TABLE public.user_tags ADD CONSTRAINT user_tags_type_check CHECK (type IN ('title', 'venue', 'dj'));
