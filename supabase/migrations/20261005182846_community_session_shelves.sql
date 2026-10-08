-- Mutually exclusive shelves; filter and classify before pagination.
CREATE FUNCTION community_private.session_shelf(shelf text, home_city text, from_date date, search_text text, filter_city text, filter_genre text, page_offset integer, page_size integer)
RETURNS SETOF public.community_session_card LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
WITH eligible AS (
 SELECT ROW(s.id, s.user_id, p.artist_name, p.avatar_url,
           s.title, s.venue, coalesce(v.city, ''), s.date, s.start_time, s.end_time,
           s.poster_url, sh.created_at, coalesce((select jsonb_agg(jsonb_build_object('user_id',cp.user_id,'artist_name',cp.artist_name,'avatar_url',cp.avatar_url) order by cp.artist_name,cp.user_id) from public.session_collaborators i join public.community_profiles cp on cp.user_id=i.dj_id and cp.is_visible where i.session_id=s.id and i.status='accepted'), '[]'::jsonb), s.poster_focus_x, s.poster_focus_y)::public.community_session_card card, s.id, s.date, s.start_time, sh.created_at,
 exists (select 1 from public.community_follows f where f.follower_id=(select auth.uid()) and (f.following_id=s.user_id or exists(select 1 from public.session_collaborators i join public.community_profiles cp on cp.user_id=i.dj_id and cp.is_visible where i.session_id=s.id and i.status='accepted' and i.dj_id=f.following_id))) followed,
 (s.date>=coalesce(from_date,current_date) AND nullif(community_private.filter_key(home_city),'') IS NOT NULL AND community_private.filter_key(v.city)=community_private.filter_key(home_city)) nearby
 FROM public.community_session_shares sh
 JOIN public.sessions s ON s.id=sh.session_id AND s.user_id=sh.user_id
 JOIN public.community_profiles p ON p.user_id=sh.user_id AND p.is_visible
 LEFT JOIN public.venues v ON v.id=s.venue_id AND v.user_id=s.user_id
 WHERE (SELECT auth.uid()) IS NOT NULL AND s.status='confirmed'
 AND (nullif(community_private.filter_key(search_text),'') IS NULL OR strpos(community_private.filter_key(concat_ws(' ',s.title,s.venue,p.artist_name,v.city)),community_private.filter_key(search_text))>0)
 AND (nullif(community_private.filter_key(filter_city),'') IS NULL OR community_private.filter_key(v.city)=community_private.filter_key(filter_city))
 AND (nullif(community_private.filter_key(filter_genre),'') IS NULL OR community_private.matches_genre(p.genres,filter_genre) OR EXISTS(SELECT 1 FROM public.session_collaborators i JOIN public.community_profiles cp ON cp.user_id=i.dj_id AND cp.is_visible WHERE i.session_id=s.id AND i.status='accepted' AND community_private.matches_genre(cp.genres,filter_genre)))
)
SELECT (e.card).* FROM eligible e
WHERE CASE shelf WHEN 'following' THEN e.followed WHEN 'city' THEN e.nearby AND NOT e.followed WHEN 'rest' THEN NOT e.followed AND NOT coalesce(e.nearby,false) ELSE false END
ORDER BY CASE WHEN shelf='city' THEN e.date END ASC, CASE WHEN shelf='city' THEN e.start_time END ASC, e.created_at DESC,e.id
LIMIT least(greatest(coalesce(page_size,20),1),50) OFFSET greatest(coalesce(page_offset,0),0);
$$;
REVOKE ALL ON FUNCTION community_private.session_shelf(text,text,date,text,text,text,integer,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION community_private.session_shelf(text,text,date,text,text,text,integer,integer) TO authenticated;
CREATE FUNCTION public.community_session_shelf(shelf text, home_city text DEFAULT '', from_date date DEFAULT current_date, search_text text DEFAULT '', filter_city text DEFAULT '', filter_genre text DEFAULT '', page_offset integer DEFAULT 0, page_size integer DEFAULT 20)
RETURNS SETOF public.community_session_card LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT * FROM community_private.session_shelf(shelf,left(home_city,300),from_date,left(search_text,100),left(filter_city,300),left(filter_genre,120),page_offset,page_size);
$$;
REVOKE ALL ON FUNCTION public.community_session_shelf(text,text,date,text,text,text,integer,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.community_session_shelf(text,text,date,text,text,text,integer,integer) TO authenticated;
