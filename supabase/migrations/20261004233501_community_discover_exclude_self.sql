-- Exclude the viewer before filtering and pagination, including unfiltered discovery.
CREATE OR REPLACE FUNCTION public.community_discover_filtered(search_name text DEFAULT '', filter_city text DEFAULT '', filter_genre text DEFAULT '', page_offset integer DEFAULT 0, page_size integer DEFAULT 20)
RETURNS SETOF public.community_profiles LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT p.* FROM public.community_profiles p
 WHERE (SELECT auth.uid()) IS NOT NULL AND p.is_visible AND p.user_id<>(SELECT auth.uid())
 AND (nullif(btrim(search_name),'') IS NULL OR strpos(community_private.filter_key(p.artist_name),community_private.filter_key(left(search_name,100)))>0)
 AND (nullif(community_private.filter_key(filter_city),'') IS NULL OR (community_private.filter_key(p.city)=community_private.filter_key(left(filter_city,300)) OR community_private.filter_key(community_private.city_label(p.city,p.city_location))=community_private.filter_key(left(filter_city,300))))
 AND (nullif(community_private.filter_key(filter_genre),'') IS NULL OR community_private.matches_genre(p.genres,left(filter_genre,120)))
 ORDER BY p.created_at DESC,p.user_id
 LIMIT least(greatest(coalesce(page_size,20),1),50) OFFSET least(greatest(coalesce(page_offset,0),0),5000);
$$;
REVOKE ALL ON FUNCTION public.community_discover_filtered(text,text,text,integer,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.community_discover_filtered(text,text,text,integer,integer) TO authenticated;
