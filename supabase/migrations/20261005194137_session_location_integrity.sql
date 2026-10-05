-- Preserve event locations independently of reusable, private place records.
ALTER TABLE public.venues ADD COLUMN city_location jsonb, ADD COLUMN archived_at timestamptz;
ALTER TABLE public.sessions ADD COLUMN venue_city text, ADD COLUMN venue_city_location jsonb, ADD COLUMN venue_address text;
CREATE INDEX sessions_venue_location_idx ON public.sessions(venue_id) WHERE venue_id IS NOT NULL;
CREATE INDEX venues_owner_active_idx ON public.venues(user_id,name) WHERE archived_at IS NULL;

-- No name matching or inference from the DJ's residence.
UPDATE public.sessions s SET venue_city=nullif(btrim(v.city),''),
 venue_address=nullif(btrim(v.address),'') FROM public.venues v
 WHERE s.venue_id=v.id AND s.user_id=v.user_id;

CREATE FUNCTION community_private.event_instant(event_date date, clock text, zone text)
RETURNS timestamptz LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF clock !~ '^([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$' THEN RETURN NULL; END IF;
 RETURN (event_date + clock::time) AT TIME ZONE coalesce(nullif(zone,''),'UTC');
EXCEPTION WHEN invalid_parameter_value THEN RETURN NULL;
END; $$;
CREATE FUNCTION community_private.session_end_at(s public.sessions)
RETURNS timestamptz LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT community_private.event_instant(s.date + CASE WHEN left(s.end_time,5)<=left(s.start_time,5) THEN 1 ELSE 0 END,s.end_time,s.booking_timezone);
$$;
REVOKE ALL ON FUNCTION community_private.event_instant(date,text,text),community_private.session_end_at(public.sessions) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION community_private.event_instant(date,text,text),community_private.session_end_at(public.sessions) TO authenticated;

CREATE FUNCTION community_private.capture_session_location()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE place public.venues;
BEGIN
 IF new.venue_id IS NOT NULL THEN
  SELECT * INTO place FROM public.venues v WHERE v.id=new.venue_id AND v.user_id=new.user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'location.ownerRequired' USING ERRCODE='42501'; END IF;
  IF place.archived_at IS NOT NULL AND (TG_OP='INSERT' OR new.venue_id IS DISTINCT FROM old.venue_id) THEN
   RAISE EXCEPTION 'location.archived' USING ERRCODE='22023';
  END IF;
  new.venue:=place.name;
  new.venue_city:=nullif(btrim(place.city),'');
  new.venue_city_location:=place.city_location;
  new.venue_address:=nullif(btrim(place.address),'');
 END IF;
 -- A deleted/detached place must not erase the event snapshot.
 RETURN new;
END; $$;
REVOKE ALL ON FUNCTION community_private.capture_session_location() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER capture_session_location BEFORE INSERT OR UPDATE OF venue_id ON public.sessions
FOR EACH ROW EXECUTE FUNCTION community_private.capture_session_location();

CREATE FUNCTION community_private.validate_place_location()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 new.name:=btrim(new.name);
 new.city:=nullif(regexp_replace(btrim(new.city),'\s+',' ','g'),'');
 IF length(new.name) NOT BETWEEN 1 AND 160 THEN RAISE EXCEPTION 'location.nameRequired' USING ERRCODE='22023'; END IF;
 IF TG_OP='INSERT' AND new.city IS NULL THEN RAISE EXCEPTION 'location.cityRequired' USING ERRCODE='22023'; END IF;
 IF TG_OP='UPDATE' AND nullif(btrim(old.city),'') IS NOT NULL AND new.city IS NULL THEN RAISE EXCEPTION 'location.cityRequired' USING ERRCODE='22023'; END IF;
 IF length(coalesce(new.city,''))>100 OR length(coalesce(new.address,''))>500 THEN RAISE EXCEPTION 'location.invalid' USING ERRCODE='22023'; END IF;
 IF new.city_location IS NOT NULL AND (
  jsonb_typeof(new.city_location)<>'object' OR
  coalesce(new.city_location->>'id','') !~ '^photon:[NRW]:[0-9]{1,20}$' OR
  community_private.filter_key(new.city_location->>'name') IS DISTINCT FROM community_private.filter_key(new.city) OR
  coalesce(length(new.city_location->>'country'),0) NOT BETWEEN 1 AND 100 OR
  coalesce(new.city_location->>'countryCode','') !~ '^[A-Z]{2}$' OR
  length(coalesce(new.city_location->>'region',''))>100 OR length(new.city_location::text)>1000
 ) THEN RAISE EXCEPTION 'location.invalid' USING ERRCODE='22023'; END IF;
 IF TG_OP='UPDATE' AND new.user_id IS DISTINCT FROM old.user_id THEN RAISE EXCEPTION 'location.ownerRequired' USING ERRCODE='42501'; END IF;
 RETURN new;
END; $$;
REVOKE ALL ON FUNCTION community_private.validate_place_location() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER validate_place_location BEFORE INSERT OR UPDATE ON public.venues FOR EACH ROW EXECUTE FUNCTION community_private.validate_place_location();

CREATE FUNCTION community_private.sync_future_place_locations()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF (new.name,new.city,new.city_location,new.address) IS DISTINCT FROM (old.name,old.city,old.city_location,old.address) THEN
  UPDATE public.sessions s SET venue=new.name,venue_city=new.city,venue_city_location=new.city_location,venue_address=new.address,updated_at=now()
  WHERE s.venue_id=new.id AND s.user_id=new.user_id
   AND community_private.event_instant(s.date,s.start_time,s.booking_timezone)>now();
 END IF;
 RETURN new;
END; $$;
REVOKE ALL ON FUNCTION community_private.sync_future_place_locations() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER sync_future_place_locations AFTER UPDATE OF name,city,city_location,address ON public.venues
FOR EACH ROW EXECUTE FUNCTION community_private.sync_future_place_locations();

CREATE FUNCTION community_private.require_shared_location()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.sessions s WHERE s.id=new.session_id AND s.user_id=(SELECT auth.uid()) AND nullif(btrim(s.venue_city),'') IS NOT NULL)
 THEN RAISE EXCEPTION 'location.completeBeforeSharing' USING ERRCODE='22023'; END IF;
 RETURN new;
END; $$;
REVOKE ALL ON FUNCTION community_private.require_shared_location() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER require_shared_location BEFORE INSERT ON public.community_session_shares
FOR EACH ROW EXECUTE FUNCTION community_private.require_shared_location();
CREATE FUNCTION community_private.city_matches(city text, location jsonb, requested text)
RETURNS boolean LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT community_private.filter_key(community_private.city_label(city,location))=community_private.filter_key(requested)
 OR (strpos(requested,' · ')=0 AND community_private.filter_key(city)=community_private.filter_key(requested));
$$;
REVOKE ALL ON FUNCTION community_private.city_matches(text,jsonb,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION community_private.city_matches(text,jsonb,text) TO authenticated;

CREATE OR REPLACE FUNCTION community_private.session_feed_filtered(only_following boolean, author uuid, page_offset integer, page_size integer, filter_city text, filter_genre text)
 RETURNS SETOF community_session_card
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
    select s.id, s.user_id, p.artist_name, p.avatar_url,
           s.title, s.venue, community_private.city_label(s.venue_city,s.venue_city_location), s.date, s.start_time, s.end_time,
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
      and (nullif(community_private.filter_key(filter_city),'') is null or community_private.city_matches(s.venue_city,s.venue_city_location,filter_city))
      and (nullif(community_private.filter_key(filter_genre),'') is null
        or community_private.matches_genre(p.genres,filter_genre)
        or exists(select 1 from public.session_collaborators i join public.community_profiles cp on cp.user_id=i.dj_id and cp.is_visible where i.session_id=s.id and i.status='accepted' and community_private.matches_genre(cp.genres,filter_genre)))
    order by sh.created_at desc, sh.session_id
    limit least(greatest(coalesce(page_size, 30), 1), 50)
    offset least(greatest(coalesce(page_offset, 0), 0), 5000);
$function$
;

CREATE OR REPLACE FUNCTION community_private.filter_options(mode text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 SELECT jsonb_build_object('cities',coalesce((
   SELECT jsonb_agg(city ORDER BY city) FROM (
    SELECT min(btrim(city)) city FROM (
      SELECT community_private.city_label(p.city,p.city_location) AS city FROM public.community_profiles p WHERE p.is_visible AND mode='djs'
      UNION ALL
      SELECT community_private.city_label(s.venue_city,s.venue_city_location) FROM public.community_session_shares sh
      JOIN public.sessions s ON s.id=sh.session_id AND s.user_id=sh.user_id AND s.status='confirmed'
      JOIN public.community_profiles p ON p.user_id=sh.user_id AND p.is_visible
      left join public.venues v ON v.id=s.venue_id AND v.user_id=s.user_id
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
$function$
;

CREATE OR REPLACE FUNCTION community_private.session_feed_search(only_following boolean, author uuid, page_offset integer, page_size integer, filter_city text, filter_genre text, search_text text)
 RETURNS SETOF community_session_card
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
    select s.id, s.user_id, p.artist_name, p.avatar_url,
           s.title, s.venue, community_private.city_label(s.venue_city,s.venue_city_location), s.date, s.start_time, s.end_time,
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
      and (nullif(community_private.filter_key(search_text),'') is null OR strpos(community_private.filter_key(concat_ws(' ',s.title,s.venue,p.artist_name,community_private.city_label(s.venue_city,s.venue_city_location))),community_private.filter_key(left(search_text,100)))>0)
      and (nullif(community_private.filter_key(filter_city),'') is null or community_private.city_matches(s.venue_city,s.venue_city_location,filter_city))
      and (nullif(community_private.filter_key(filter_genre),'') is null
        or community_private.matches_genre(p.genres,filter_genre)
        or exists(select 1 from public.session_collaborators i join public.community_profiles cp on cp.user_id=i.dj_id and cp.is_visible where i.session_id=s.id and i.status='accepted' and community_private.matches_genre(cp.genres,filter_genre)))
    order by sh.created_at desc, sh.session_id
    limit least(greatest(coalesce(page_size, 30), 1), 50)
    offset least(greatest(coalesce(page_offset, 0), 0), 5000);
$function$
;

CREATE OR REPLACE FUNCTION community_private.profile_posters(author uuid, page_offset integer, page_size integer)
 RETURNS SETOF community_session_card
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
    select s.id, s.user_id, p.artist_name, p.avatar_url,
           s.title, s.venue, community_private.city_label(s.venue_city,s.venue_city_location), s.date, s.start_time, s.end_time,
           s.poster_url, sh.created_at, coalesce((select jsonb_agg(jsonb_build_object('user_id',cp.user_id,'artist_name',cp.artist_name,'avatar_url',cp.avatar_url) order by cp.artist_name,cp.user_id) from public.session_collaborators i join public.community_profiles cp on cp.user_id=i.dj_id and cp.is_visible where i.session_id=s.id and i.status='accepted'), '[]'::jsonb), s.poster_focus_x, s.poster_focus_y
    from public.community_session_shares sh
    join public.sessions s on s.id = sh.session_id and s.user_id = sh.user_id
    join public.community_profiles p on p.user_id = sh.user_id and p.is_visible
    left join public.venues v on v.id = s.venue_id and v.user_id = s.user_id
    where (select auth.uid()) is not null and author is not null
      and s.status='confirmed' and community_private.session_end_at(s) <= now() and nullif(btrim(s.poster_url),'') is not null
      and exists(select 1 from public.community_profiles target where target.user_id=author and target.is_visible)
      and (s.user_id=author or exists(select 1 from public.session_collaborators i where i.session_id=s.id and i.status='accepted' and i.dj_id=author))
    order by s.date desc,s.id
    limit least(greatest(coalesce(page_size,20),1),50)
    offset greatest(coalesce(page_offset,0),0);
$function$
;

CREATE OR REPLACE FUNCTION community_private.following_activity(search_text text, filter_city text, filter_genre text, page_offset integer, page_size integer)
 RETURNS TABLE(kind text, id uuid, published_at timestamp with time zone, payload jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
WITH activity AS (
 SELECT 'session'::text kind, s.id, sh.created_at published_at,
 to_jsonb(ROW(s.id, s.user_id, p.artist_name, p.avatar_url,
           s.title, s.venue, community_private.city_label(s.venue_city,s.venue_city_location), s.date, s.start_time, s.end_time,
           s.poster_url, sh.created_at, coalesce((select jsonb_agg(jsonb_build_object('user_id',cp.user_id,'artist_name',cp.artist_name,'avatar_url',cp.avatar_url) order by cp.artist_name,cp.user_id) from public.session_collaborators i join public.community_profiles cp on cp.user_id=i.dj_id and cp.is_visible where i.session_id=s.id and i.status='accepted'), '[]'::jsonb), s.poster_focus_x, s.poster_focus_y)::public.community_session_card) payload
 FROM public.community_session_shares sh
    join public.sessions s on s.id = sh.session_id and s.user_id = sh.user_id
    join public.community_profiles p on p.user_id = sh.user_id and p.is_visible
    left join public.venues v on v.id = s.venue_id and v.user_id = s.user_id
    where (select auth.uid()) is not null and s.status = 'confirmed'
      and (exists (
        select 1 from public.community_follows f where f.follower_id = (select auth.uid()) and (f.following_id = s.user_id or exists(select 1 from public.session_collaborators i join public.community_profiles cp on cp.user_id=i.dj_id and cp.is_visible where i.session_id=s.id and i.status='accepted' and i.dj_id=f.following_id))
      ))
      and (nullif(community_private.filter_key(search_text),'') is null OR strpos(community_private.filter_key(concat_ws(' ',s.title,s.venue,p.artist_name,community_private.city_label(s.venue_city,s.venue_city_location))),community_private.filter_key(left(search_text,100)))>0)
      and (nullif(community_private.filter_key(filter_city),'') is null or community_private.city_matches(s.venue_city,s.venue_city_location,filter_city))
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
$function$
;

CREATE OR REPLACE FUNCTION community_private.session_shelf(shelf text, home_city text, from_date date, search_text text, filter_city text, filter_genre text, page_offset integer, page_size integer)
 RETURNS SETOF community_session_card
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
WITH eligible AS (
 SELECT ROW(s.id, s.user_id, p.artist_name, p.avatar_url,
           s.title, s.venue, community_private.city_label(s.venue_city,s.venue_city_location), s.date, s.start_time, s.end_time,
           s.poster_url, sh.created_at, coalesce((select jsonb_agg(jsonb_build_object('user_id',cp.user_id,'artist_name',cp.artist_name,'avatar_url',cp.avatar_url) order by cp.artist_name,cp.user_id) from public.session_collaborators i join public.community_profiles cp on cp.user_id=i.dj_id and cp.is_visible where i.session_id=s.id and i.status='accepted'), '[]'::jsonb), s.poster_focus_x, s.poster_focus_y)::public.community_session_card card, s.id, s.date, s.start_time, sh.created_at,
 exists (select 1 from public.community_follows f where f.follower_id=(select auth.uid()) and (f.following_id=s.user_id or exists(select 1 from public.session_collaborators i join public.community_profiles cp on cp.user_id=i.dj_id and cp.is_visible where i.session_id=s.id and i.status='accepted' and i.dj_id=f.following_id))) followed,
 (community_private.session_end_at(s) > now() AND nullif(community_private.filter_key(home_city),'') IS NOT NULL AND community_private.city_matches(s.venue_city,s.venue_city_location,home_city)) nearby
 FROM public.community_session_shares sh
 JOIN public.sessions s ON s.id=sh.session_id AND s.user_id=sh.user_id
 JOIN public.community_profiles p ON p.user_id=sh.user_id AND p.is_visible
 LEFT JOIN public.venues v ON v.id=s.venue_id AND v.user_id=s.user_id
 WHERE (SELECT auth.uid()) IS NOT NULL AND s.status='confirmed'
 AND (nullif(community_private.filter_key(search_text),'') IS NULL OR strpos(community_private.filter_key(concat_ws(' ',s.title,s.venue,p.artist_name,community_private.city_label(s.venue_city,s.venue_city_location))),community_private.filter_key(search_text))>0)
 AND (nullif(community_private.filter_key(filter_city),'') IS NULL OR community_private.city_matches(s.venue_city,s.venue_city_location,filter_city))
 AND (nullif(community_private.filter_key(filter_genre),'') IS NULL OR community_private.matches_genre(p.genres,filter_genre) OR EXISTS(SELECT 1 FROM public.session_collaborators i JOIN public.community_profiles cp ON cp.user_id=i.dj_id AND cp.is_visible WHERE i.session_id=s.id AND i.status='accepted' AND community_private.matches_genre(cp.genres,filter_genre)))
)
SELECT (e.card).* FROM eligible e
WHERE CASE shelf WHEN 'following' THEN e.followed WHEN 'city' THEN e.nearby AND NOT e.followed WHEN 'rest' THEN NOT e.followed AND NOT coalesce(e.nearby,false) ELSE false END
ORDER BY CASE WHEN shelf='city' THEN e.date END ASC, CASE WHEN shelf='city' THEN e.start_time END ASC, e.created_at DESC,e.id
LIMIT least(greatest(coalesce(page_size,20),1),50) OFFSET greatest(coalesce(page_offset,0),0);
$function$
;

CREATE OR REPLACE FUNCTION community_private.session_feed(only_following boolean, author uuid, page_offset integer, page_size integer)
 RETURNS SETOF community_session_card
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
    select s.id, s.user_id, p.artist_name, p.avatar_url,
           s.title, s.venue, community_private.city_label(s.venue_city,s.venue_city_location), s.date, s.start_time, s.end_time,
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
    order by sh.created_at desc, sh.session_id
    limit least(greatest(coalesce(page_size, 30), 1), 50)
    offset least(greatest(coalesce(page_offset, 0), 0), 5000);
$function$
;

CREATE OR REPLACE FUNCTION community_private.notify_social_activity()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare actor uuid; actor_name text; title text;
begin
    if TG_TABLE_NAME='community_follows' then
        select p.artist_name into actor_name from public.community_profiles p where p.user_id=new.follower_id and p.is_visible;
        if actor_name is not null then
            insert into public.social_notifications(recipient_id,actor_id,kind,actor_name)
            values(new.following_id,new.follower_id,'follow',actor_name);
        end if;
    elsif TG_TABLE_NAME='community_session_shares' then
        select s.title,p.artist_name into title,actor_name from public.sessions s
          join public.community_profiles p on p.user_id=s.user_id and p.is_visible
          where s.id=new.session_id and s.user_id=new.user_id and s.status='confirmed';
        if actor_name is not null then
            insert into public.social_notifications(recipient_id,actor_id,kind,session_id,actor_name,session_title)
            select f.follower_id,new.user_id,'shared_session',new.session_id,actor_name,title
            from public.community_follows f where f.following_id=new.user_id;
        end if;
    elsif TG_TABLE_NAME='session_collaborators' then
        select s.title into title from public.sessions s where s.id=new.session_id;
        if TG_OP='INSERT' then
            select p.artist_name into actor_name from public.users_profile p where p.id=new.inviter_id;
            insert into public.social_notifications(recipient_id,actor_id,kind,session_id,actor_name,session_title)
            values(new.dj_id,new.inviter_id,'session_invitation',new.session_id,coalesce(actor_name,'DJ'),title);
        elsif new.status is distinct from old.status then
            select p.artist_name into actor_name from public.users_profile p where p.id=new.dj_id;
            insert into public.social_notifications(recipient_id,actor_id,kind,session_id,actor_name,session_title,response)
            values(new.inviter_id,new.dj_id,'invitation_response',new.session_id,coalesce(actor_name,new.artist_name),title,new.status);
        end if;
    elsif TG_TABLE_NAME='sessions' and (new.title,community_private.filter_key(concat_ws(' ',new.venue,community_private.city_label(new.venue_city,new.venue_city_location),new.venue_address)),new.venue_id,new.date,new.start_time,new.end_time,new.booking_timezone,new.status) is distinct from (old.title,community_private.filter_key(concat_ws(' ',old.venue,community_private.city_label(old.venue_city,old.venue_city_location),old.venue_address)),old.venue_id,old.date,old.start_time,old.end_time,old.booking_timezone,old.status) then
        select p.artist_name into actor_name from public.users_profile p where p.id=new.user_id;
        insert into public.social_notifications(recipient_id,actor_id,kind,session_id,actor_name,session_title)
        select i.dj_id,new.user_id,'session_update',new.id,coalesce(actor_name,'DJ'),new.title
        from public.session_collaborators i where i.session_id=new.id and i.status in ('invited','accepted');
    end if;
    return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION community_private.collaboration_inbox(page_offset integer)
 RETURNS SETOF jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select jsonb_build_object('session_id',s.id,'dj_id',i.dj_id,'status',i.status,'inviter_id',i.inviter_id,
  'owner_name',coalesce(p.artist_name,'DJ'),'created_at',i.created_at,
  'session',jsonb_build_object('id',s.id,'user_id',s.user_id,'date',s.date,'title',s.title,'venue',s.venue,'venue_city',s.venue_city,'venue_city_location',s.venue_city_location,'venue_address',s.venue_address,'booking_timezone',s.booking_timezone,
   'start_time',s.start_time,'end_time',s.end_time,'color',s.color,'status',s.status,'poster_url',s.poster_url,'poster_focus_x',s.poster_focus_x,'poster_focus_y',s.poster_focus_y,
   'is_collective',true,'djs','[]'::jsonb,'earning_type','free','earning_amount',0,'currency',s.currency,
   'created_at',s.created_at,'updated_at',s.updated_at,'is_guest',true,'owner_name',coalesce(p.artist_name,'DJ')))
 from public.session_collaborators i join public.sessions s on s.id=i.session_id and s.user_id=i.inviter_id
 left join public.users_profile p on p.id=s.user_id
 where auth.uid() is not null and i.dj_id=auth.uid()
 order by i.created_at desc,i.session_id limit 1000 offset greatest(coalesce(page_offset,0),0);
$function$
;

CREATE OR REPLACE FUNCTION public.create_session_series(input jsonb, session_dates date[])
 RETURNS SETOF sessions
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE
    owner_id uuid := auth.uid();
    first_session public.sessions;
BEGIN
    IF owner_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
    IF session_dates IS NULL OR cardinality(session_dates) NOT BETWEEN 1 AND 500
       OR session_dates[1] IS DISTINCT FROM (input->>'date')::date
       OR array_position(session_dates, NULL) IS NOT NULL THEN
        RAISE EXCEPTION 'Invalid session dates';
    END IF;

    PERFORM pg_advisory_xact_lock(hashtextextended(owner_id::text, 301));
    IF NOT (public.get_session_usage()->>'isPro')::boolean
       AND (public.get_session_usage()->>'count')::bigint + cardinality(session_dates)>30 THEN
        RAISE EXCEPTION 'session_limit_reached' USING ERRCODE='P0001';
    END IF;

    INSERT INTO public.sessions (
        user_id, date, title, venue, start_time, end_time, color,
        is_collective, djs, earning_type, earning_amount, currency,
        recurrence_type, recurrence_end_date, venue_id, booking_timezone, status, poster_url, dj_profile_ids, poster_focus_x, poster_focus_y, fee_agreement
    ) VALUES (
        owner_id, session_dates[1], input->>'title', input->>'venue',
        input->>'start_time', input->>'end_time', COALESCE(input->>'color', '#262626'),
        COALESCE((input->>'is_collective')::boolean, false),
        ARRAY(SELECT jsonb_array_elements_text(COALESCE(input->'djs', '[]'::jsonb))),
        COALESCE(input->>'earning_type', 'free'), COALESCE((input->>'earning_amount')::numeric, 0),
        COALESCE(input->>'currency', '€'), COALESCE(input->>'recurrence_type', 'none'),
        (input->>'recurrence_end_date')::date, (input->>'venue_id')::uuid, nullif(input->>'booking_timezone',''),
        COALESCE(input->>'status', 'confirmed'), input->>'poster_url', ARRAY(SELECT jsonb_array_elements_text(COALESCE(input->'dj_profile_ids','[]'::jsonb))::uuid),
        COALESCE((input->>'poster_focus_x')::double precision, 0.5), COALESCE((input->>'poster_focus_y')::double precision, 0.5), NULLIF(input->'fee_agreement','null'::jsonb)
    ) RETURNING * INTO first_session;

    INSERT INTO public.sessions (
        user_id, date, title, venue, start_time, end_time, color,
        is_collective, djs, earning_type, earning_amount, currency,
        recurrence_type, recurrence_end_date, venue_id, booking_timezone, status, poster_url, dj_profile_ids, poster_focus_x, poster_focus_y, fee_agreement, parent_session_id
    ) SELECT
        owner_id, occurrence, first_session.title, first_session.venue,
        first_session.start_time, first_session.end_time, first_session.color,
        first_session.is_collective, first_session.djs, first_session.earning_type,
        first_session.earning_amount, first_session.currency, first_session.recurrence_type,
        first_session.recurrence_end_date, first_session.venue_id, first_session.booking_timezone, first_session.status,
        first_session.poster_url, first_session.dj_profile_ids, first_session.poster_focus_x, first_session.poster_focus_y, first_session.fee_agreement, first_session.id
    FROM unnest(session_dates) WITH ORDINALITY AS dates(occurrence, position)
    WHERE position > 1;
    RETURN NEXT first_session;
END;
$function$
;
DROP TRIGGER notify_session_updates ON public.sessions;
CREATE TRIGGER notify_session_updates AFTER UPDATE OF title,venue,venue_id,venue_city,venue_city_location,venue_address,date,start_time,end_time,booking_timezone,status ON public.sessions FOR EACH ROW EXECUTE FUNCTION community_private.notify_social_activity();

CREATE FUNCTION community_private.validate_session_timezone()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF new.booking_timezone IS NOT NULL AND NOT EXISTS(SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name=new.booking_timezone)
 THEN RAISE EXCEPTION 'location.invalidTimezone' USING ERRCODE='22023'; END IF;
 RETURN new;
END; $$;
REVOKE ALL ON FUNCTION community_private.validate_session_timezone() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER validate_session_timezone BEFORE INSERT OR UPDATE OF booking_timezone ON public.sessions FOR EACH ROW EXECUTE FUNCTION community_private.validate_session_timezone();
