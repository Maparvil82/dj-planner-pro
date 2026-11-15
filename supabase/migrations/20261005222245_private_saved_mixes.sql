-- Private references: no copied audio, public activity or author notification.
CREATE TABLE public.saved_mixes (
 owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 mix_id uuid NOT NULL REFERENCES public.community_profile_mixes(id) ON DELETE CASCADE,
 saved_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (owner_id,mix_id)
);
CREATE INDEX saved_mixes_mix_idx ON public.saved_mixes(mix_id);
CREATE INDEX saved_mixes_owner_date_idx ON public.saved_mixes(owner_id,saved_at DESC,mix_id);
ALTER TABLE public.saved_mixes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.saved_mixes FROM anon,authenticated;
GRANT SELECT,DELETE ON public.saved_mixes TO authenticated;
GRANT INSERT(owner_id,mix_id) ON public.saved_mixes TO authenticated;
CREATE POLICY saved_mixes_read ON public.saved_mixes FOR SELECT TO authenticated
 USING(owner_id=(SELECT auth.uid()));
CREATE POLICY saved_mixes_insert ON public.saved_mixes FOR INSERT TO authenticated
 WITH CHECK(owner_id=(SELECT auth.uid()) AND EXISTS(SELECT 1 FROM public.community_profile_mixes m WHERE m.id=mix_id));
CREATE POLICY saved_mixes_delete ON public.saved_mixes FOR DELETE TO authenticated
 USING(owner_id=(SELECT auth.uid()));

CREATE FUNCTION public.saved_mix_list(page_offset integer DEFAULT 0,page_size integer DEFAULT 20)
RETURNS TABLE(id uuid,user_id uuid,title text,source_url text,platform text,created_at timestamptz,artist_name text,avatar_url text,saved_at timestamptz)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT m.id,m.user_id,m.title,m.source_url,m.platform,m.created_at,p.artist_name,p.avatar_url,b.saved_at
 FROM public.saved_mixes b
 JOIN public.community_profile_mixes m ON m.id=b.mix_id
 JOIN public.community_profiles p ON p.user_id=m.user_id
 WHERE b.owner_id=(SELECT auth.uid()) AND (p.is_visible OR p.user_id=(SELECT auth.uid()))
 ORDER BY b.saved_at DESC,b.mix_id
 LIMIT least(greatest(coalesce(page_size,20),1),50) OFFSET greatest(coalesce(page_offset,0),0);
$$;
REVOKE ALL ON FUNCTION public.saved_mix_list(integer,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.saved_mix_list(integer,integer) TO authenticated;
