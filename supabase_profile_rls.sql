-- Enable RLS on users_profile
ALTER TABLE public.users_profile ENABLE ROW LEVEL SECURITY;

-- Allow users to view their own profile
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users_profile;
CREATE POLICY "Users can view their own profile" ON public.users_profile
    FOR SELECT 
    USING (auth.uid() = id);

-- Allow users to insert their own profile (Crucial for registration)
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.users_profile;
CREATE POLICY "Users can insert their own profile" ON public.users_profile
    FOR INSERT 
    WITH CHECK (auth.uid() = id);

-- Allow users to update their own profile (Crucial for registration and profile editing)
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users_profile;
CREATE POLICY "Users can update their own profile" ON public.users_profile
    FOR UPDATE 
    USING (auth.uid() = id);
