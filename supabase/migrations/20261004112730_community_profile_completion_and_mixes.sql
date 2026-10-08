-- Canonical musical styles, retaining legacy values already saved by the owner.
create or replace function community_private.normalize_profile_genres()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare token text; canonical text; result text[] := '{}'; legacy text[] := '{}';
begin
    if TG_OP = 'UPDATE' then legacy := regexp_split_to_array(old.genres, '[,·;|]'); end if;
    foreach token in array regexp_split_to_array(new.genres, '[,·;|]') loop
        token := btrim(token); if token = '' then continue; end if;
        select label into canonical from (values ('house','House'),
('deep house','Deep House'),
('tech house','Tech House'),
('progressive house','Progressive House'),
('afro house','Afro House'),
('organic house','Organic House'),
('melodic house','Melodic House'),
('disco house','Disco House'),
('soulful house','Soulful House'),
('techno','Techno'),
('melodic techno','Melodic Techno'),
('hard techno','Hard Techno'),
('minimal','Minimal'),
('trance','Trance'),
('progressive trance','Progressive Trance'),
('psytrance','Psytrance'),
('drum & bass','Drum & Bass'),
('jungle','Jungle'),
('dubstep','Dubstep'),
('uk garage','UK Garage'),
('bass house','Bass House'),
('breakbeat','Breakbeat'),
('electro','Electro'),
('electronica','Electronica'),
('ambient','Ambient'),
('downtempo','Downtempo'),
('disco','Disco'),
('nu disco','Nu Disco'),
('funk','Funk'),
('soul','Soul'),
('hip hop','Hip Hop'),
('r&b','R&B'),
('reggaeton','Reggaeton'),
('afrobeats','Afrobeats'),
('dancehall','Dancehall'),
('latin','Latin'),
('salsa','Salsa'),
('bachata','Bachata'),
('pop','Pop'),
('rock','Rock'),
('indie dance','Indie Dance'),
('dance','Dance'),
('edm','EDM'),
('hardstyle','Hardstyle'),
('hardcore','Hardcore'),
('open format','Open Format'),
('hause','House'),
('haus','House'),
('dnb','Drum & Bass'),
('drum and bass','Drum & Bass'),
('drum n bass','Drum & Bass'),
('hip-hop','Hip Hop'),
('hiphop','Hip Hop'),
('rnb','R&B'),
('r and b','R&B'),
('reggaetón','Reggaeton'),
('regueton','Reggaeton'),
('nu-disco','Nu Disco'),
('tech-house','Tech House'),
('deep-house','Deep House'),
('jazz','Jazz'),
('nu jazz','Nu Jazz'),
('acid jazz','Acid Jazz'),
('jazz funk','Jazz Funk'),
('swing','Swing'),
('blues','Blues'),
('bossa nova','Bossa Nova'),
('chillout','Chillout'),
('trip hop','Trip Hop'),
('italo disco','Italo Disco'),
('electro swing','Electro Swing'),
('baile funk','Baile Funk'),
('flamenco','Flamenco'),
('world','World'),
('classical','Classical')) as catalog(alias,label)
          where alias = lower(regexp_replace(token, '\s+', ' ', 'g')) limit 1;
        if canonical is null then
            if TG_OP = 'UPDATE' and exists(select 1 from unnest(legacy) v where btrim(v)=token) then canonical := token;
            else raise exception 'Choose a musical style from the catalogue' using errcode='22023'; end if;
        end if;
        if not canonical = any(result) then result := array_append(result,canonical); end if;
    end loop;
    new.genres := array_to_string(result, ' · '); return new;
end;
$$;
revoke all on function community_private.normalize_profile_genres() from public, anon, authenticated;

-- Drafts remain editable. Social actions require a real photo, city and styles.
create function community_private.profile_complete(avatar text, city text, genres text)
returns boolean language sql immutable security invoker set search_path = '' as $$
 select coalesce(avatar ~ '^https://[^[:space:]<>]+$',false)
    and coalesce(city ~ '[^[:space:]]',false)
    and coalesce(genres ~ '[^[:space:],·;|]',false);
$$;
revoke all on function community_private.profile_complete(text,text,text) from public,anon;
grant execute on function community_private.profile_complete(text,text,text) to authenticated;
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
    insert into public.community_profiles (user_id, artist_name, avatar_url, city, genres, bio, is_visible, cover_url, mixcloud_url, soundcloud_url, instagram_url)
    values (owner_id, artist, avatar, btrim(coalesce(input->>'city','')), btrim(coalesce(input->>'genres','')),
        btrim(coalesce(input->>'bio','')), coalesce((input->>'is_visible')::boolean, false), nullif(btrim(input->>'cover_url'), ''), btrim(coalesce(input->>'mixcloud_url','')), btrim(coalesce(input->>'soundcloud_url','')), btrim(coalesce(input->>'instagram_url','')))
    on conflict (user_id) do update set artist_name = excluded.artist_name, avatar_url = excluded.avatar_url,
        city = excluded.city, genres = excluded.genres, bio = excluded.bio, is_visible = excluded.is_visible,
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

drop policy community_profiles_insert on public.community_profiles;
create policy community_profiles_insert on public.community_profiles for insert to authenticated
with check (user_id = (select auth.uid())
    and (not is_visible or community_private.profile_complete(avatar_url,city,genres))
    and exists(select 1 from public.users_profile p where p.id=user_id
      and p.artist_name=community_profiles.artist_name
      and p.avatar_url is not distinct from community_profiles.avatar_url));

drop policy community_profiles_update on public.community_profiles;
create policy community_profiles_update on public.community_profiles for update to authenticated
using(user_id = (select auth.uid()))
with check (user_id = (select auth.uid())
    and (not is_visible or community_private.profile_complete(avatar_url,city,genres))
    and exists(select 1 from public.users_profile p where p.id=user_id
      and p.artist_name=community_profiles.artist_name
      and p.avatar_url is not distinct from community_profiles.avatar_url));

drop policy community_follows_insert on public.community_follows;
create policy community_follows_insert on public.community_follows for insert to authenticated
with check (follower_id=(select auth.uid())
    and exists(select 1 from public.community_profiles p where p.user_id=following_id and p.is_visible)
    and exists(select 1 from public.community_profiles p where p.user_id=(select auth.uid()) and p.is_visible
      and community_private.profile_complete(p.avatar_url,p.city,p.genres)));

-- New session publications use the same complete public identity.
drop policy community_shares_insert on public.community_session_shares;
create policy community_shares_insert on public.community_session_shares for insert to authenticated
with check(user_id=(select auth.uid())
    and exists(select 1 from public.sessions s where s.id=session_id and s.user_id=(select auth.uid()) and s.status='confirmed')
    and exists(select 1 from public.community_profiles p where p.user_id=(select auth.uid()) and p.is_visible
      and community_private.profile_complete(p.avatar_url,p.city,p.genres)));

-- Individual recordings are separate from bookings and agenda sessions. No quota.
create table public.community_profile_mixes (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.community_profiles(user_id) on delete cascade,
    title text not null check(length(btrim(title)) between 1 and 100),
    platform text not null check(platform in ('mixcloud','soundcloud')),
    source_url text not null check(length(source_url) <= 500),
    created_at timestamptz not null default now(),
    unique(user_id,source_url),
    constraint community_mix_source_valid check (
        (platform='mixcloud' and source_url ~ '^https://www[.]mixcloud[.]com/[A-Za-z0-9_-]+/[A-Za-z0-9_-]+/$')
        or (platform='soundcloud' and source_url ~ '^https://soundcloud[.]com/[A-Za-z0-9_-]+/[A-Za-z0-9_-]+$')),
    constraint community_mix_individual check (
      lower(split_part(source_url,'/',4)) <> all(array['discover','search','genres','live','upload','settings','you','stream','charts','playlists','sets','tracks','likes','reposts','followers','following','favorites'])
      and lower(split_part(source_url,'/',5)) <> all(array['discover','search','genres','live','upload','settings','you','stream','charts','playlists','sets','tracks','likes','reposts','followers','following','favorites']))
);
alter table public.community_profile_mixes enable row level security;
revoke all on public.community_profile_mixes from public,anon,authenticated;
grant select,insert,delete on public.community_profile_mixes to authenticated;
grant update(title,platform,source_url) on public.community_profile_mixes to authenticated;
create policy community_mixes_read on public.community_profile_mixes for select to authenticated
using(user_id=(select auth.uid()) or exists(select 1 from public.community_profiles p where p.user_id=community_profile_mixes.user_id and p.is_visible));
create policy community_mixes_insert on public.community_profile_mixes for insert to authenticated
with check(user_id=(select auth.uid()) and exists(select 1 from public.community_profiles p where p.user_id=(select auth.uid()) and community_private.profile_complete(p.avatar_url,p.city,p.genres)));
create policy community_mixes_update on public.community_profile_mixes for update to authenticated
using(user_id=(select auth.uid()))
with check(user_id=(select auth.uid()) and exists(select 1 from public.community_profiles p where p.user_id=(select auth.uid()) and community_private.profile_complete(p.avatar_url,p.city,p.genres)));
create policy community_mixes_delete on public.community_profile_mixes for delete to authenticated
using(user_id=(select auth.uid()));
create index community_mixes_owner_created_idx on public.community_profile_mixes(user_id,created_at desc,id);
