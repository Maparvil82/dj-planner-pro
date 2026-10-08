-- Only public posters from past, shared performances; accepted guests also appear.
CREATE FUNCTION community_private.profile_posters(author uuid, page_offset integer, page_size integer)
RETURNS SETOF public.community_session_card LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
    select s.id, s.user_id, p.artist_name, p.avatar_url,
           s.title, s.venue, coalesce(v.city, ''), s.date, s.start_time, s.end_time,
           s.poster_url, sh.created_at, coalesce((select jsonb_agg(jsonb_build_object('user_id',cp.user_id,'artist_name',cp.artist_name,'avatar_url',cp.avatar_url) order by cp.artist_name,cp.user_id) from public.session_collaborators i join public.community_profiles cp on cp.user_id=i.dj_id and cp.is_visible where i.session_id=s.id and i.status='accepted'), '[]'::jsonb), s.poster_focus_x, s.poster_focus_y
    from public.community_session_shares sh
    join public.sessions s on s.id = sh.session_id and s.user_id = sh.user_id
    join public.community_profiles p on p.user_id = sh.user_id and p.is_visible
    left join public.venues v on v.id = s.venue_id and v.user_id = s.user_id
    where (select auth.uid()) is not null and author is not null
      and s.status='confirmed' and s.date < current_date and nullif(btrim(s.poster_url),'') is not null
      and exists(select 1 from public.community_profiles target where target.user_id=author and target.is_visible)
      and (s.user_id=author or exists(select 1 from public.session_collaborators i where i.session_id=s.id and i.status='accepted' and i.dj_id=author))
    order by s.date desc,s.id
    limit least(greatest(coalesce(page_size,20),1),50)
    offset greatest(coalesce(page_offset,0),0);
$$;
REVOKE ALL ON FUNCTION community_private.profile_posters(uuid,integer,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION community_private.profile_posters(uuid,integer,integer) TO authenticated;
CREATE FUNCTION public.community_profile_posters(author uuid, page_offset integer DEFAULT 0, page_size integer DEFAULT 20)
RETURNS SETOF public.community_session_card LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT * FROM community_private.profile_posters(author,page_offset,page_size);
$$;
REVOKE ALL ON FUNCTION public.community_profile_posters(uuid,integer,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.community_profile_posters(uuid,integer,integer) TO authenticated;
