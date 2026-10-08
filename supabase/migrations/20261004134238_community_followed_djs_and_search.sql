-- Followed DJs are independent of whether they have published any sessions.
CREATE OR REPLACE FUNCTION public.community_followed_djs(search_name text DEFAULT '', filter_city text DEFAULT '', filter_genre text DEFAULT '', page_offset integer DEFAULT 0, page_size integer DEFAULT 20)
RETURNS SETOF public.community_profiles LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT p.* FROM public.community_profiles p
 WHERE (SELECT auth.uid()) IS NOT NULL AND p.is_visible AND EXISTS (SELECT 1 FROM public.community_follows f WHERE f.follower_id=(SELECT auth.uid()) AND f.following_id=p.user_id)
 AND (nullif(btrim(search_name),'') IS NULL OR strpos(community_private.filter_key(p.artist_name),community_private.filter_key(left(search_name,100)))>0)
 AND (nullif(community_private.filter_key(filter_city),'') IS NULL OR (community_private.filter_key(p.city)=community_private.filter_key(left(filter_city,300)) OR community_private.filter_key(community_private.city_label(p.city,p.city_location))=community_private.filter_key(left(filter_city,300))))
 AND (nullif(community_private.filter_key(filter_genre),'') IS NULL OR community_private.matches_genre(p.genres,left(filter_genre,120)))
 ORDER BY p.created_at DESC,p.user_id
 LIMIT least(greatest(coalesce(page_size,20),1),50) OFFSET least(greatest(coalesce(page_offset,0),0),5000);
$$;
REVOKE ALL ON FUNCTION public.community_followed_djs(text,text,text,integer,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.community_followed_djs(text,text,text,integer,integer) TO authenticated;



-- Text search runs before pagination, with the same opt-in/public projection.
create or replace function community_private.session_feed_search(only_following boolean, author uuid, page_offset integer, page_size integer, filter_city text, filter_genre text, search_text text)
returns setof public.community_session_card
language sql stable security definer set search_path = ''
as $$
    select s.id, s.user_id, p.artist_name, p.avatar_url,
           s.title, s.venue, coalesce(v.city, ''), s.date, s.start_time, s.end_time,
           s.poster_url, sh.created_at, coalesce((select jsonb_agg(jsonb_build_object('user_id',cp.user_id,'artist_name',cp.artist_name,'avatar_url',cp.avatar_url) order by cp.artist_name,cp.user_id) from public.session_collaborators i join public.community_profiles cp on cp.user_id=i.dj_id and cp.is_visible where i.session_id=s.id and i.status='accepted'), '[]'::jsonb), s.poster_focus_x, s.poster_focus_y
    from public.community_session_shares sh
    join public.sessions s on s.id = sh.session_id and s.user_id = sh.user_id
    join public.community_profiles p on p.user_id = sh.user_id and p.is_visible
    left join public.venues v on v.id = s.venue_id and v.user_id = s.user_id
    where (select auth.uid()) is not null and s.status = 'confirmed'
      and (author is null or s.user_id = author or exists(select 1 from public.session_collaborators i join public.community_profiles cp on cp.user_id=i.dj_id and cp.is_visible where i.session_id=s.id and i.status='accepted' and i.dj_id=author))
      and (not coalesce(only_following, false) or exists (
        select 1 from public.community_follows f where f.follower_id = (select auth.uid()) and (f.following_id = s.user_id or exists(select 1 from public.session_collaborators i join public.community_profiles cp on cp.user_id=i.dj_id and cp.is_visible where i.session_id=s.id and i.status='accepted' and i.dj_id=f.following_id))
      ))
      and (nullif(community_private.filter_key(search_text),'') is null OR strpos(community_private.filter_key(concat_ws(' ',s.title,s.venue,p.artist_name,v.city)),community_private.filter_key(left(search_text,100)))>0)
      and (nullif(community_private.filter_key(filter_city),'') is null or community_private.filter_key(v.city)=community_private.filter_key(filter_city))
      and (nullif(community_private.filter_key(filter_genre),'') is null
        or community_private.matches_genre(p.genres,filter_genre)
        or exists(select 1 from public.session_collaborators i join public.community_profiles cp on cp.user_id=i.dj_id and cp.is_visible where i.session_id=s.id and i.status='accepted' and community_private.matches_genre(cp.genres,filter_genre)))
    order by sh.created_at desc, sh.session_id
    limit least(greatest(coalesce(page_size, 30), 1), 50)
    offset least(greatest(coalesce(page_offset, 0), 0), 5000);
$$;

REVOKE ALL ON FUNCTION community_private.session_feed_search(boolean,uuid,integer,integer,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION community_private.session_feed_search(boolean,uuid,integer,integer,text,text,text) TO authenticated;
CREATE FUNCTION public.community_feed_search(only_following boolean DEFAULT false, author uuid DEFAULT null, page_offset integer DEFAULT 0, page_size integer DEFAULT 20, filter_city text DEFAULT '', filter_genre text DEFAULT '', search_text text DEFAULT '')
RETURNS SETOF public.community_session_card LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT * FROM community_private.session_feed_search(only_following,author,page_offset,page_size,left(filter_city,100),left(filter_genre,120),left(search_text,100));
$$;
REVOKE ALL ON FUNCTION public.community_feed_search(boolean,uuid,integer,integer,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.community_feed_search(boolean,uuid,integer,integer,text,text,text) TO authenticated;

