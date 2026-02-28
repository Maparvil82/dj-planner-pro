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

/* --- NEW MIGRATIONS FOR SESSION EARNINGS --- */
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS earning_type text DEFAULT 'free' CHECK (earning_type IN ('free', 'hourly', 'fixed'));
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS earning_amount numeric DEFAULT 0;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS currency text DEFAULT '€';

/* --- UPDATE EXISTING TAGS TO NEUTRAL COLOR --- */
UPDATE public.user_tags SET color = '#262626';

/* --- RECURRING SESSIONS --- */
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS recurrence_type text DEFAULT 'none' CHECK (recurrence_type IN ('none', 'daily', 'weekly', 'monthly', 'yearly'));
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS recurrence_end_date date;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS parent_session_id uuid REFERENCES public.sessions(id) ON DELETE CASCADE;
