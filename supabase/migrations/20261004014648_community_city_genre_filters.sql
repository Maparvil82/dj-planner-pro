-- Filters run before LIMIT/OFFSET. Public projections and opt-in rules remain unchanged.
CREATE FUNCTION community_private.filter_key(value text) RETURNS text
LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT btrim(regexp_replace(translate(lower(coalesce(value,'')), 'áàâäãåéèêëíìîïóòôöõúùûüñç', 'aaaaaaeeeeiiiiooooouuuunc'), '[[:space:]]+', ' ', 'g'));
$$;
CREATE FUNCTION community_private.matches_genre(value text, genre text) RETURNS boolean
LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM regexp_split_to_table(coalesce(value,''),'[,·;|]') token WHERE community_private.filter_key(token)=community_private.filter_key(genre));
$$;
REVOKE ALL ON FUNCTION community_private.filter_key(text), community_private.matches_genre(text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION community_private.filter_key(text), community_private.matches_genre(text,text) TO authenticated;

create or replace function community_private.session_feed_filtered(only_following boolean, author uuid, page_offset integer, page_size integer, filter_city text, filter_genre text)
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
      and (nullif(community_private.filter_key(filter_city),'') is null or community_private.filter_key(v.city)=community_private.filter_key(filter_city))
      and (nullif(community_private.filter_key(filter_genre),'') is null
        or community_private.matches_genre(p.genres,filter_genre)
        or exists(select 1 from public.session_collaborators i join public.community_profiles cp on cp.user_id=i.dj_id and cp.is_visible where i.session_id=s.id and i.status='accepted' and community_private.matches_genre(cp.genres,filter_genre)))
    order by sh.created_at desc, sh.session_id
    limit least(greatest(coalesce(page_size, 30), 1), 50)
    offset least(greatest(coalesce(page_offset, 0), 0), 5000);
$$;

REVOKE ALL ON FUNCTION community_private.session_feed_filtered(boolean,uuid,integer,integer,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION community_private.session_feed_filtered(boolean,uuid,integer,integer,text,text) TO authenticated;
CREATE FUNCTION public.community_feed_filtered(only_following boolean DEFAULT false, author uuid DEFAULT null, page_offset integer DEFAULT 0, page_size integer DEFAULT 20, filter_city text DEFAULT '', filter_genre text DEFAULT '')
RETURNS SETOF public.community_session_card LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT * FROM community_private.session_feed_filtered(only_following,author,page_offset,page_size,left(filter_city,100),left(filter_genre,120));
$$;
REVOKE ALL ON FUNCTION public.community_feed_filtered(boolean,uuid,integer,integer,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.community_feed_filtered(boolean,uuid,integer,integer,text,text) TO authenticated;

CREATE FUNCTION public.community_discover_filtered(search_name text DEFAULT '', filter_city text DEFAULT '', filter_genre text DEFAULT '', page_offset integer DEFAULT 0, page_size integer DEFAULT 20)
RETURNS SETOF public.community_profiles LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT p.* FROM public.community_profiles p
 WHERE (SELECT auth.uid()) IS NOT NULL AND p.is_visible
 AND (nullif(btrim(search_name),'') IS NULL OR strpos(community_private.filter_key(p.artist_name),community_private.filter_key(left(search_name,100)))>0)
 AND (nullif(community_private.filter_key(filter_city),'') IS NULL OR community_private.filter_key(p.city)=community_private.filter_key(left(filter_city,100)))
 AND (nullif(community_private.filter_key(filter_genre),'') IS NULL OR community_private.matches_genre(p.genres,left(filter_genre,120)))
 ORDER BY p.created_at DESC,p.user_id
 LIMIT least(greatest(coalesce(page_size,20),1),50) OFFSET least(greatest(coalesce(page_offset,0),0),5000);
$$;
REVOKE ALL ON FUNCTION public.community_discover_filtered(text,text,text,integer,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.community_discover_filtered(text,text,text,integer,integer) TO authenticated;

CREATE FUNCTION community_private.filter_options(mode text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('cities',coalesce((
   SELECT jsonb_agg(city ORDER BY city) FROM (
    SELECT min(btrim(city)) city FROM (
      SELECT p.city FROM public.community_profiles p WHERE p.is_visible AND mode='djs'
      UNION ALL
      SELECT v.city FROM public.community_session_shares sh
      JOIN public.sessions s ON s.id=sh.session_id AND s.user_id=sh.user_id AND s.status='confirmed'
      JOIN public.community_profiles p ON p.user_id=sh.user_id AND p.is_visible
      JOIN public.venues v ON v.id=s.venue_id AND v.user_id=s.user_id
      WHERE mode='sessions'
    ) c WHERE nullif(btrim(city),'') IS NOT NULL GROUP BY community_private.filter_key(city)
   ) distinct_cities
 ),'[]'::jsonb),'genres',coalesce((
   SELECT jsonb_agg(genre ORDER BY genre) FROM (
    SELECT min(btrim(token)) genre FROM public.community_profiles p
    CROSS JOIN LATERAL regexp_split_to_table(p.genres,'[,·;|]') token
    WHERE p.is_visible AND nullif(btrim(token),'') IS NOT NULL GROUP BY community_private.filter_key(token)
   ) distinct_genres
 ),'[]'::jsonb)) WHERE (SELECT auth.uid()) IS NOT NULL;
$$;
REVOKE ALL ON FUNCTION community_private.filter_options(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION community_private.filter_options(text) TO authenticated;
CREATE FUNCTION public.community_filter_options(mode text DEFAULT 'sessions') RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT community_private.filter_options(mode);
$$;
REVOKE ALL ON FUNCTION public.community_filter_options(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.community_filter_options(text) TO authenticated;
