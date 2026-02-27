-- NEW TABLE FOR AUTO-SUGGEST TAGS

CREATE TABLE IF NOT EXISTS public.user_tags (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users NOT NULL,
    type text NOT NULL CHECK (type IN ('title', 'venue')),
    name text NOT NULL,
    created_at timestamptz DEFAULT now(),
    -- Ensure we don't save duplicate tags for the same user and type
    UNIQUE (user_id, type, name)
);

-- Note: Ensure Row Level Security (RLS) is configured for this table in your Supabase Dashboard
-- so that users can only select and insert their own tags.

-- OPTION: Add RLS Policies so the tags can be inserted from the app:

ALTER TABLE public.user_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own tags." 
ON public.user_tags FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own tags." 
ON public.user_tags FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own tags." 
ON public.user_tags FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tags." 
ON public.user_tags FOR DELETE 
USING (auth.uid() = user_id);
