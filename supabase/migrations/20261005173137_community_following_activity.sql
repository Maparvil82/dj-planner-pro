-- A single chronology, filtered before pagination, with only safe public fields.
CREATE FUNCTION community_private.following_activity(search_text text, filter_city text, filter_genre text, page_offset integer, page_size integer)
RETURNS TABLE(kind text,id uuid,published_at timestamptz,payload jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
WITH activity AS (
 SELECT 'session'::text kind, s.id, sh.created_at published_at,
 to_jsonb(ROW(s.id, s.user_id, p.artist_name, p.avatar_url,
           s.title, s.venue, coalesce(v.city, ''), s.date, s.start_time, s.end_time,
           s.poster_url, sh.created_at, coalesce((select jsonb_agg(jsonb_build_object('user_id',cp.user_id,'artist_name',cp.artist_name,'avatar_url',cp.avatar_url) order by cp.artist_name,cp.user_id) from public.session_collaborators i join public.community_profiles cp on cp.user_id=i.dj_id and cp.is_visible where i.session_id=s.id and i.status='accepted'), '[]'::jsonb), s.poster_focus_x, s.poster_focus_y)::public.community_session_card) payload
 FROM public.community_session_shares sh
    join public.sessions s on s.id = sh.session_id and s.user_id = sh.user_id
    join public.community_profiles p on p.user_id = sh.user_id and p.is_visible
    left join public.venues v on v.id = s.venue_id and v.user_id = s.user_id
    where (select auth.uid()) is not null and s.status = 'confirmed'
      and (exists (
        select 1 from public.community_follows f where f.follower_id = (select auth.uid()) and (f.following_id = s.user_id or exists(select 1 from public.session_collaborators i join public.community_profiles cp on cp.user_id=i.dj_id and cp.is_visible where i.session_id=s.id and i.status='accepted' and i.dj_id=f.following_id))
      ))
      and (nullif(community_private.filter_key(search_text),'') is null OR strpos(community_private.filter_key(concat_ws(' ',s.title,s.venue,p.artist_name,v.city)),community_private.filter_key(left(search_text,100)))>0)
      and (nullif(community_private.filter_key(filter_city),'') is null or community_private.filter_key(v.city)=community_private.filter_key(filter_city))
      and (nullif(community_private.filter_key(filter_genre),'') is null
        or community_private.matches_genre(p.genres,filter_genre)
        or exists(select 1 from public.session_collaborators i join public.community_profiles cp on cp.user_id=i.dj_id and cp.is_visible where i.session_id=s.id and i.status='accepted' and community_private.matches_genre(cp.genres,filter_genre)))

 UNION ALL
 SELECT 'mix'::text, m.id, m.created_at,
 jsonb_build_object('id',m.id,'user_id',m.user_id,'title',m.title,'source_url',m.source_url,'platform',m.platform,'created_at',m.created_at,'artist_name',p.artist_name,'avatar_url',p.avatar_url,'city',p.city)
 FROM public.community_profile_mixes m
 JOIN public.community_profiles p ON p.user_id=m.user_id AND p.is_visible
 WHERE (SELECT auth.uid()) IS NOT NULL
 AND EXISTS(SELECT 1 FROM public.community_follows f WHERE f.follower_id=(SELECT auth.uid()) AND f.following_id=m.user_id)
 AND (nullif(community_private.filter_key(search_text),'') IS NULL OR strpos(community_private.filter_key(concat_ws(' ',m.title,p.artist_name,p.city)),community_private.filter_key(left(search_text,100)))>0)
 AND (nullif(community_private.filter_key(filter_city),'') IS NULL OR community_private.filter_key(p.city)=community_private.filter_key(filter_city) OR community_private.filter_key(community_private.city_label(p.city,p.city_location))=community_private.filter_key(filter_city))
 AND (nullif(community_private.filter_key(filter_genre),'') IS NULL OR community_private.matches_genre(p.genres,filter_genre))
)
SELECT a.kind,a.id,a.published_at,a.payload FROM activity a
ORDER BY a.published_at DESC,a.kind,a.id
LIMIT least(greatest(coalesce(page_size,20),1),50) OFFSET greatest(coalesce(page_offset,0),0);
$$;
REVOKE ALL ON FUNCTION community_private.following_activity(text,text,text,integer,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION community_private.following_activity(text,text,text,integer,integer) TO authenticated;
CREATE FUNCTION public.community_following_activity(search_text text DEFAULT '', filter_city text DEFAULT '', filter_genre text DEFAULT '', page_offset integer DEFAULT 0, page_size integer DEFAULT 20)
RETURNS TABLE(kind text,id uuid,published_at timestamptz,payload jsonb)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT * FROM community_private.following_activity(left(search_text,100),left(filter_city,300),left(filter_genre,120),page_offset,page_size);
$$;
REVOKE ALL ON FUNCTION public.community_following_activity(text,text,text,integer,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.community_following_activity(text,text,text,integer,integer) TO authenticated;
