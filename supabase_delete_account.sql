-- Function to allow a user to delete their own account and all associated data
-- This is a SECURITY DEFINER function, which means it runs with bypass-RLS privileges
-- to allow cleaning up auth.users (restricted) from the client side.

CREATE OR REPLACE FUNCTION public.delete_user_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid;
BEGIN
  -- 1. Get the current user ID from the JWT
  current_user_id := auth.uid();

  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 2. Delete from custom tables (Ensure cascade is handled or delete manually)
  -- The users_profile table might have a foreign key to auth.users
  -- If you have other tables like 'sessions', 'venues', 'expenses', 
  -- ensure they are deleted if they don't have ON DELETE CASCADE.
  
  -- Delete profile (this should trigger other cascades if set up)
  DELETE FROM public.users_profile WHERE id = current_user_id;

  -- 3. Delete from auth.users (This is the "nuclear" option that really deletes the account)
  DELETE FROM auth.users WHERE id = current_user_id;
END;
$$;

-- Grant access to authenticated users
GRANT EXECUTE ON FUNCTION public.delete_user_data() TO authenticated;
