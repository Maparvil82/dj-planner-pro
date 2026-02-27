-- UPGRADE SESSIONS TABLE

-- 1. Add new columns
ALTER TABLE public.sessions 
ADD COLUMN IF NOT EXISTS title text,
ADD COLUMN IF NOT EXISTS venue text,
ADD COLUMN IF NOT EXISTS start_time text,
ADD COLUMN IF NOT EXISTS end_time text;

-- 2. Update existing rows with default values so we can enforce NOT NULL safely, if desired
UPDATE public.sessions SET title = 'Untitled Session' WHERE title IS NULL;
UPDATE public.sessions SET venue = 'Unknown Venue' WHERE venue IS NULL;

-- 3. Make title and venue required (optional, but good practice)
ALTER TABLE public.sessions 
ALTER COLUMN title SET NOT NULL,
ALTER COLUMN venue SET NOT NULL;
