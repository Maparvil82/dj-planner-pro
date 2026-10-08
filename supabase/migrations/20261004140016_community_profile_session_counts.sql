-- Count the same public sessions shown on a DJ profile, without exposing private agenda data.
CREATE FUNCTION community_private.profile_session_counts(author_ids uuid[])
RETURNS TABLE(user_id uuid, session_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT p.user_id, count(DISTINCT s.id)
 FROM public.community_profiles p
 LEFT JOIN public.sessions s ON s.status='confirmed'
 AND (s.user_id=p.user_id OR EXISTS (
   SELECT 1 FROM public.session_collaborators i
   WHERE i.session_id=s.id AND i.dj_id=p.user_id AND i.status='accepted'
 ))
 AND EXISTS (
   SELECT 1 FROM public.community_session_shares sh
   JOIN public.community_profiles owner ON owner.user_id=sh.user_id AND owner.is_visible
   WHERE sh.session_id=s.id AND sh.user_id=s.user_id
 )
 WHERE (SELECT auth.uid()) IS NOT NULL AND p.is_visible
 AND p.user_id=ANY(author_ids)
 GROUP BY p.user_id;
$$;
REVOKE ALL ON FUNCTION community_private.profile_session_counts(uuid[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION community_private.profile_session_counts(uuid[]) TO authenticated;
CREATE FUNCTION public.community_profile_session_counts(author_ids uuid[])
RETURNS TABLE(user_id uuid, session_count bigint)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT * FROM community_private.profile_session_counts(author_ids[1:50]);
$$;
REVOKE ALL ON FUNCTION public.community_profile_session_counts(uuid[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.community_profile_session_counts(uuid[]) TO authenticated;
