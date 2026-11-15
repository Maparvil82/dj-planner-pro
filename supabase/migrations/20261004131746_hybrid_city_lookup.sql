-- Location metadata is optional: old/manual profiles remain valid.
alter table public.community_profiles add column city_location jsonb;
create function community_private.validate_city_location()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.city_location is not null then
  if jsonb_typeof(new.city_location) <> 'object'
    or coalesce(new.city_location->>'id','') !~ '^photon:[NRW]:[0-9]{1,20}$'
    or coalesce(length(new.city_location->>'name'),0) not between 1 and 100
    or community_private.filter_key(new.city_location->>'name') <> community_private.filter_key(new.city)
    or coalesce(length(new.city_location->>'country'),0) not between 1 and 100
    or coalesce(new.city_location->>'countryCode','') !~ '^[A-Z]{2}$'
    or length(coalesce(new.city_location->>'region','')) > 100
    or length(new.city_location::text) > 1000 then
   raise exception 'Invalid city location' using errcode='22023';
  end if;
  new.city_location := jsonb_build_object('id',new.city_location->>'id','name',new.city_location->>'name','region',coalesce(new.city_location->>'region',''),'country',new.city_location->>'country','countryCode',new.city_location->>'countryCode');
 end if;
 return new;
end;
$$;
revoke all on function community_private.validate_city_location() from public,anon,authenticated;
create trigger validate_city_location before insert or update on public.community_profiles
for each row execute function community_private.validate_city_location();

create function community_private.city_label(city text, location jsonb) returns text
language sql immutable security invoker set search_path='' as $$
 select concat_ws(' · ',city,nullif(location->>'region',''),nullif(location->>'country',''));
$$;
revoke all on function community_private.city_label(text,jsonb) from public,anon;
grant execute on function community_private.city_label(text,jsonb) to authenticated;

-- RLS exposes only opt-in profiles; drafts and their cities stay private.
create function public.community_city_suggestions(search_city text default '')
returns table(city text,city_location jsonb)
language sql stable security invoker set search_path='' as $$
 select distinct on (coalesce(p.city_location->>'id',community_private.filter_key(p.city)))
   p.city,p.city_location
 from public.community_profiles p
 where (select auth.uid()) is not null and p.is_visible and nullif(btrim(p.city),'') is not null
 and strpos(community_private.filter_key(p.city),community_private.filter_key(left(search_city,100)))>0
 order by coalesce(p.city_location->>'id',community_private.filter_key(p.city)),p.created_at,p.user_id
 limit 20;
$$;
revoke all on function public.community_city_suggestions(text) from public,anon;
grant execute on function public.community_city_suggestions(text) to authenticated;

create or replace function public.save_unified_profile(input jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
    owner_id uuid := auth.uid();
    artist text := btrim(coalesce(input->>'artist_name', ''));
    avatar text := nullif(input->>'avatar_url', '');
    account public.users_profile;
    social public.community_profiles;
begin
    if owner_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
    if length(artist) not between 1 and 80 then raise exception 'Invalid artist name' using errcode = '22023'; end if;
    if coalesce((input->>'is_visible')::boolean,false) and not community_private.profile_complete(avatar,input->>'city',input->>'genres') then
        raise exception 'Complete your DJ profile: photo, city and musical styles required' using errcode='22023';
    end if;
    -- Transactional save: a failed social validation also rolls back the account update.
    insert into public.users_profile (id, artist_name, avatar_url, updated_at)
    values (owner_id, artist, avatar, now())
    on conflict (id) do update set artist_name = excluded.artist_name, avatar_url = excluded.avatar_url, updated_at = excluded.updated_at
    returning * into account;
    insert into public.community_profiles (user_id, artist_name, avatar_url, city, genres, bio, is_visible, cover_url, mixcloud_url, soundcloud_url, instagram_url, city_location)
    values (owner_id, artist, avatar, btrim(coalesce(input->>'city','')), btrim(coalesce(input->>'genres','')),
        btrim(coalesce(input->>'bio','')), coalesce((input->>'is_visible')::boolean, false), nullif(btrim(input->>'cover_url'), ''), btrim(coalesce(input->>'mixcloud_url','')), btrim(coalesce(input->>'soundcloud_url','')), btrim(coalesce(input->>'instagram_url','')), nullif(input->'city_location','null'::jsonb))
    on conflict (user_id) do update set artist_name = excluded.artist_name, avatar_url = excluded.avatar_url,
        city = excluded.city, city_location = case when input ? 'city_location' then excluded.city_location when community_private.filter_key(excluded.city)=community_private.filter_key(community_profiles.city) then community_profiles.city_location else null end, genres = excluded.genres, bio = excluded.bio, is_visible = excluded.is_visible,
        cover_url = case when input ? 'cover_url' then excluded.cover_url else community_profiles.cover_url end,
        mixcloud_url = case when input ? 'mixcloud_url' then excluded.mixcloud_url else community_profiles.mixcloud_url end,
        soundcloud_url = case when input ? 'soundcloud_url' then excluded.soundcloud_url else community_profiles.soundcloud_url end,
        instagram_url = case when input ? 'instagram_url' then excluded.instagram_url else community_profiles.instagram_url end
    returning * into social;
    return jsonb_build_object('profile', to_jsonb(account), 'community', to_jsonb(social));
end;
$$;
revoke all on function public.save_unified_profile(jsonb) from public, anon;
grant execute on function public.save_unified_profile(jsonb) to authenticated;

CREATE OR REPLACE FUNCTION public.community_discover_filtered(search_name text DEFAULT '', filter_city text DEFAULT '', filter_genre text DEFAULT '', page_offset integer DEFAULT 0, page_size integer DEFAULT 20)
RETURNS SETOF public.community_profiles LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT p.* FROM public.community_profiles p
 WHERE (SELECT auth.uid()) IS NOT NULL AND p.is_visible
 AND (nullif(btrim(search_name),'') IS NULL OR strpos(community_private.filter_key(p.artist_name),community_private.filter_key(left(search_name,100)))>0)
 AND (nullif(community_private.filter_key(filter_city),'') IS NULL OR (community_private.filter_key(p.city)=community_private.filter_key(left(filter_city,300)) OR community_private.filter_key(community_private.city_label(p.city,p.city_location))=community_private.filter_key(left(filter_city,300))))
 AND (nullif(community_private.filter_key(filter_genre),'') IS NULL OR community_private.matches_genre(p.genres,left(filter_genre,120)))
 ORDER BY p.created_at DESC,p.user_id
 LIMIT least(greatest(coalesce(page_size,20),1),50) OFFSET least(greatest(coalesce(page_offset,0),0),5000);
$$;
REVOKE ALL ON FUNCTION public.community_discover_filtered(text,text,text,integer,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.community_discover_filtered(text,text,text,integer,integer) TO authenticated;


CREATE OR REPLACE FUNCTION community_private.filter_options(mode text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('cities',coalesce((
   SELECT jsonb_agg(city ORDER BY city) FROM (
    SELECT min(btrim(city)) city FROM (
      SELECT community_private.city_label(p.city,p.city_location) AS city FROM public.community_profiles p WHERE p.is_visible AND mode='djs'
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
